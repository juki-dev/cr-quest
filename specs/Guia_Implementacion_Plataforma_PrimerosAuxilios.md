# Guía de Implementación paso a paso

## Plataforma de entrenamiento en evaluación de pacientes — Cruz Roja

Guía pensada para construir la plataforma **usando agentes de codificación con IA** (Claude Code, Cursor u otro). Cada fase está descompuesta en tareas pequeñas y verificables, con un ejemplo de instrucción para el agente y criterios de aceptación.

> **Regla de oro de todo el proyecto:** el agente **implementa**, no inventa protocolos médicos. Toda secuencia correcta y todo material clínico lo define y valida una persona con formación certificada. La IA nunca es la fuente de verdad de lo que está bien o mal.

> **Nota sobre esta versión:** esta guía incorpora las decisiones más recientes: infraestructura fija en CDK, generación de casos por **batch nocturno acumulativo** (una librería que va creciendo, no un reemplazo diario), un flujo de revisión antes de publicar cada caso, y un **leaderboard general por usuario** basado en la suma de aciertos, pensado para incentivar tanto el volumen como la calidad. Se elimina el concepto de "ciclos fijos" de la versión anterior: ya no hace falta, porque el puntaje acumulado por usuario diluye por sí solo las diferencias de dificultad entre casos.

---

## Cómo trabajar con el agente (léelo antes de empezar)

Antes de la Fase 1, deja lista tu forma de trabajo. Esto marca la diferencia entre un agente que ayuda y uno que te genera código imposible de mantener.

1. **Archivo de contexto del proyecto.** Crea en la raíz del repo un archivo de instrucciones permanentes para el agente (`CLAUDE.md` para Claude Code, `.cursorrules` para Cursor, o `AGENTS.md` genérico). Ahí vive el stack, las convenciones y la regla de oro. El agente lo lee en cada sesión. Tienes una plantilla al final de esta guía.
2. **Incrementos pequeños y verificables.** Pide una tarea por vez, revisa, prueba y confirma antes de seguir. Nada de "constrúyeme toda la app".
3. **Tests primero en la lógica crítica.** El motor de validación (Fase 3) y el cálculo de puntos (Fase 6) se prueban con tests unitarios *antes* de darlos por buenos.
4. **Humano en el bucle en lo médico.** Cualquier cambio que toque secuencias correctas o contenido clínico lo revisa un instructor. Márcalo en el PR. Ningún caso generado por IA llega a un voluntario sin pasar por revisión.
5. **Commits pequeños y descriptivos** para poder revertir con facilidad.

**Stack recomendado:**

| Capa | Elección | Motivo |
| :--- | :--- | :--- |
| Infra | AWS CDK (TypeScript) | Elección fija. Todo en TS; infraestructura como código versionada y cómoda para agentes. |
| Backend | Node.js + TypeScript en Lambda + API Gateway | Serverless, coste cero en reposo. |
| Datos | DynamoDB (diseño single-table) con GSI | Leaderboard pre-ordenado sin motor de búsqueda. |
| Generación programada | Amazon EventBridge Scheduler → Lambda | Dispara el batch nocturno que llena la librería de casos. |
| IA | Amazon Bedrock (SDK v3: `@aws-sdk/client-bedrock-runtime`) | Datos dentro del perímetro AWS. |
| Frontend | Next.js + **@dnd-kit** | dnd-kit tiene accesibilidad por teclado y táctil (react-beautiful-dnd está descontinuado). |

**Sobre los modelos:** usa **Claude Sonnet 4.6 para generar escenarios** (calidad narrativa, en el batch nocturno) y **Claude Haiku 4.5 para el feedback/evaluación** (más barato y suficiente cuando explica contra una respuesta ya fijada). Consulta el ID de modelo vigente en la consola de Bedrock en vez de hardcodearlo. Activa **prompt caching** para el material instructivo (ahorra hasta ~90% del input repetido) y usa la **API de batch inference de Bedrock** para la generación nocturna (50% de descuento frente a on-demand, y aquí encaja de forma natural porque ya generas varios casos de una sola vez). Documentación de Claude Code: https://docs.claude.com/en/docs/claude-code/overview

---

## Fase 0 — Preparación del entorno

**Objetivo:** repositorio listo, herramientas instaladas, agente configurado.

**Tareas:**
- Crear el repo con estructura de monorepo simple: `/infra`, `/backend`, `/frontend`, `/domain`.
- Configurar TypeScript en modo estricto, ESLint y Prettier compartidos.
- Instalar y configurar tu agente (p. ej. Claude Code vía npm).
- Configurar credenciales de AWS y una cuenta de AWS de pruebas.
- Crear el archivo de contexto del proyecto (plantilla al final).

**Prompt para el agente (ejemplo):**
> "Inicializa un monorepo con pnpm workspaces y carpetas `infra`, `backend`, `frontend`, `domain`. Configura TypeScript estricto, ESLint y Prettier a nivel raíz. No escribas lógica de negocio todavía, solo el andamiaje y los scripts de `lint`, `test` y `build`."

**Criterios de aceptación:** `pnpm install` funciona, `pnpm lint` y `pnpm build` pasan en un proyecto vacío, y existe el archivo de contexto del agente.

---

## Fase 1 — Fuente de verdad: el dominio médico

Esta fase es la más importante y **la lidera un instructor, no el agente**. Define qué es "correcto" antes de programar nada que lo evalúe.

**Objetivo:** modelar los pasos de evaluación y las secuencias correctas validadas.

**Tareas:**
- Definir la **taxonomía de pasos** de evaluación de pacientes (evaluación primaria → APH) como datos semilla. Cada paso: `stepId`, etiqueta, descripción, categoría.
- Definir el **esquema de plantilla de escenario**: tipo de caso, dificultad, y `correctSequence` (lista ordenada de `stepId`). La narrativa concreta del paciente la rellena la IA en la Fase 4, pero la secuencia correcta sale siempre de aquí.
- Redactar un primer conjunto de plantillas con su secuencia correcta, **revisado y firmado por un instructor certificado**, alineado al protocolo de tu regional.
- Guardar todo como archivos versionados (JSON/TS) en `/domain`, con campos `validatedBy` y `validatedAt`.

**Prompt para el agente (ejemplo):**
> "En `/domain`, crea tipos TypeScript para `AssessmentStep` y `ScenarioTemplate` según este esquema [pegar esquema]. Genera los archivos de datos semilla a partir de este contenido que te doy [pegar contenido validado por el instructor]. No inventes pasos ni cambies el orden: transcribe exactamente lo que te paso."

**Criterios de aceptación:** los tipos compilan, los datos semilla validan contra el esquema, y cada plantilla tiene su secuencia correcta marcada como validada por una persona.

> **Nota de diseño clave:** aquí resolvemos la tensión del documento original. La IA generará *narrativa* a partir de estas plantillas (Fase 4), pero la *secuencia correcta* siempre sale de estos datos validados, nunca del modelo.

---

## Fase 2 — Infraestructura serverless base (diseño single-table)

**Objetivo:** esqueleto de infra desplegable, sin lógica aún, con un esquema de datos que soporte la librería creciente de casos y el leaderboard general.

**Tareas:**
- Con CDK: definir API Gateway, funciones Lambda (stubs), tablas DynamoDB, y la regla de EventBridge Scheduler para el batch nocturno.

**Tabla `Scenarios`** — la librería de casos, que crece cada noche:
- PK `SCENARIO#<id>`.
- Atributos: `templateId` (referencia a la plantilla de `/domain`), narrativa generada, `correctSequence`, y **`status`**: `borrador` → `revisado` → `publicado` (o `rechazado`). Solo los casos en `publicado` se muestran a los voluntarios.
- Atributos de auditoría: `generatedAt`, `reviewedBy`, `reviewedAt`.

**Tabla `Attempts`** (diseño single-table, partición por usuario) — guarda el historial y los agregados de cada voluntario:
- PK `USER#<userId>`.
- SK `ATTEMPT#<timestamp>#<scenarioId>`: registro histórico de cada intento — `submittedOrder`, `accuracy` (el % de esa vez), `scenarioId`.
- SK `BEST#<scenarioId>`: el **mejor `accuracy`** que ese usuario logró en ese caso concreto. Se actualiza solo si un nuevo intento supera al anterior.
- SK `STATS`: agregados del usuario — `totalPoints` (suma de todos sus `BEST#<scenarioId>.accuracy`) y `casesCompleted` (cantidad de casos distintos intentados). Este ítem es lo que alimenta el leaderboard.
- **GSI para el leaderboard general:** clave de partición constante (p. ej. un atributo `recordType = "STATS"` presente solo en los ítems `STATS`), clave de ordenación `totalPoints` (numérico). Permite leer el ranking completo de usuarios con una sola `Query` descendente, sin escanear toda la tabla.

**Prompt para el agente (ejemplo):**
> "En `/infra` con AWS CDK en TypeScript, define la tabla `Scenarios` con el esquema [pegar] incluyendo el campo `status`. Define la tabla `Attempts` en diseño single-table con las claves y tipos de ítem que te describo [pegar: ATTEMPT#, BEST#, STATS]. Añade un GSI sobre `Attempts` con partición en `recordType` y ordenación numérica en `totalPoints`. Crea Lambdas stub para `generateScenarioBatch`, `reviewScenario`, `getPublishedScenario`, `submitAttempt` y `getLeaderboard`, expuestas por API Gateway donde corresponda. Añade una regla de EventBridge Scheduler que dispare `generateScenarioBatch` todas las noches. No implementes la lógica interna todavía."

**Criterios de aceptación:** `cdk synth` genera la plantilla sin errores, `cdk deploy` crea los recursos en tu cuenta de pruebas, y la regla de EventBridge queda programada (aunque la Lambda sea un stub).

---

## Fase 3 — Motor de validación por reglas (determinista)

**Objetivo:** comparar el orden del usuario contra la secuencia correcta, sin IA, de forma rápida y fiable.

**Tareas:**
- Escribir una función **pura** `validateOrder(submitted, correct)` que devuelva la exactitud y los pasos mal colocados. **Fórmula:** `accuracy = (pasos que el usuario puso en la posición correcta) ÷ (total de pasos de la respuesta)`. Comparación posición por posición; si el usuario omite un paso, todos los siguientes quedan corridos y cuentan como mal colocados (así una omisión baja el porcentaje de forma natural, sin castigos extra).
- El resultado de esta función (`accuracy`) es el que se guarda en `ATTEMPT#...` y el que compite por convertirse en el nuevo `BEST#<scenarioId>` del usuario.
- **Tests unitarios exhaustivos**: orden perfecto, orden invertido, pasos intercambiados, listas incompletas, etc.

**Prompt para el agente (ejemplo):**
> "Implementa `validateOrder` como función pura en `/backend/domain`. Debe recibir el orden enviado y el correcto, y devolver `{ accuracy, misplacedSteps }`. Escribe primero los tests unitarios cubriendo estos casos [listar], luego la implementación hasta que pasen."

**Criterios de aceptación:** cobertura de tests alta en esta función, todos los casos límite pasan, y no hay ninguna llamada a IA en este módulo.

---

## Fase 4 — Generación de casos por batch nocturno + integración con IA (Bedrock)

**Objetivo:** una librería de casos que **crece poco a poco cada noche** (no se reemplaza), con un filtro de revisión antes de que cualquier caso llegue a un voluntario, y feedback de IA siempre anclado a los datos validados.

**Tareas:**

- **Generación nocturna (acumulativa):** la regla de EventBridge Scheduler dispara `generateScenarioBatch` una vez al día. Esta Lambda toma N plantillas de `/domain` (con su `correctSequence` ya fijada) y le pide a Bedrock (Sonnet 4.6, usando la **API de batch inference**) que redacte **solo la narrativa** del paciente para cada una — nunca el orden. Cada caso nuevo se guarda en `Scenarios` con `status = borrador`, **sumándose** a los que ya existían. La librería nunca se vacía ni se sobreescribe.
- **Revisión antes de publicar:** un instructor revisa los casos en `borrador` (vía un panel simple o incluso una cola manual al inicio) y los pasa a `revisado`/`publicado`, o los marca `rechazado` si algo no cuadra. Solo lo `publicado` es visible para los voluntarios. Esta compuerta es la que evita que un caso mal generado llegue a alguien sin filtro.
- **Selección de caso al entrar el voluntario:** `getPublishedScenario` elige un caso al azar (o el menos practicado por ese usuario) entre los `publicado`. Es una simple lectura — no hay generación en tiempo real por intento.
- **Feedback con IA (grounded):** al enviar el intento, el prompt incluye la secuencia correcta, el orden del usuario y los pasos mal colocados que ya calculó el motor de reglas (Fase 3). La IA (Haiku 4.5) solo *explica por qué*, no juzga si está bien.
- Activar **prompt caching** sobre el material instructivo inyectado tanto en la generación nocturna como en el feedback (es el mismo contenido en cada llamada → gran ahorro).

**Prompt para el agente (ejemplo):**
> "Implementa la Lambda `generateScenarioBatch`, invocada por el scheduler de EventBridge, que toma un lote de plantillas de `/domain` y usa la API de batch inference de Bedrock para redactar solo la narrativa de cada una, dejando la secuencia correcta intacta. Guarda cada caso nuevo en `Scenarios` con `status: 'borrador'`, sin borrar ni tocar los casos existentes. Implementa por separado `reviewScenario` para pasar un caso de `borrador` a `publicado` o `rechazado`. Implementa `getPublishedScenario` para devolver un caso aleatorio entre los publicados."

**Criterios de aceptación:** cada corrida nocturna **añade** casos nuevos sin afectar los ya publicados; ningún caso llega a `publicado` sin pasar por `reviewScenario`; los escenarios generados nunca modifican la secuencia correcta; el feedback siempre cita los pasos mal colocados que vienen del motor de reglas; el caching está activo.

---

## Fase 5 — Frontend (Next.js + dnd-kit)

**Objetivo:** interfaz para resolver casos publicados, ordenar pasos y ver feedback y el leaderboard general.

**Tareas:**
- Pantalla de escenario: al entrar, pide un caso publicado (`getPublishedScenario`) y muestra su narrativa junto a una lista desordenada de pasos.
- Drag-and-drop con **@dnd-kit**, con soporte de teclado y táctil (accesibilidad).
- Envío de la respuesta a `submitAttempt` y visualización del feedback (exactitud + explicación de la IA).
- Pantalla de **leaderboard general**: lista de voluntarios ordenados por `totalPoints`, mostrando también `casesCompleted` para que se vea que el puntaje viene de resolver muchos casos, no solo de acertar unos pocos.

**Prompt para el agente (ejemplo):**
> "Crea la pantalla de escenario en Next.js con @dnd-kit para ordenar los pasos, pidiendo el caso a `getPublishedScenario`. Asegura navegación por teclado y arrastre táctil. Al enviar, llama al endpoint `submitAttempt` y muestra el resultado con las explicaciones. Crea la pantalla de leaderboard general mostrando puntos totales y cantidad de casos completados por usuario."

**Criterios de aceptación:** se puede completar un escenario con ratón, teclado y en móvil; el feedback se muestra con claridad; el leaderboard muestra puntos y casos completados; la UI está en español.

---

## Fase 6 — Puntuación y leaderboard general (volumen + calidad, sin tiempo)

**Objetivo:** el leaderboard es una **ayuda para que los voluntarios memoricen la secuencia de pasos**, no una evaluación firme, y a la vez incentiva que resuelvan la mayor cantidad de casos posible, y que los resuelvan bien. El tiempo no interviene en nada.

**Cómo funciona (fórmula del intento, igual que antes):**
> `accuracy del intento = (pasos en la posición correcta) ÷ (total de pasos de la respuesta)`

**Cómo se acumula el puntaje del usuario (nuevo):**
- Por cada caso, solo cuenta su **mejor intento** (`BEST#<scenarioId>`). Repetir un caso puede mejorar tu marca en ese caso, pero no infla el total con intentos repetidos — así el incentivo real es resolver casos *nuevos*, no repetir el mismo una y otra vez. *(Este es el criterio recomendado por defecto; si prefieres que cada intento sume aunque se repita el caso, es un cambio menor en el agregador.)*
- `totalPoints = suma de los mejores `accuracy` de cada caso distinto resuelto.`
- Esto logra exactamente lo que buscas: para subir en el ranking hay que **resolver más casos** (más términos en la suma) **y resolverlos bien** (cada término pesa según qué tan bien se hizo). Un caso mal hecho no perjudica, pero tampoco ayuda casi nada — no compensa "spamear" casos al azar.
- La suma total funciona sobre cualquier cantidad de casos publicados, sin necesidad de un conjunto fijo por ciclo: como cada caso aporta su propio porcentaje, la dificultad dispar entre casos se diluye sola a medida que el voluntario resuelve más.

**Tareas:**
- Al recibir un intento: calcular `accuracy` (Fase 3), guardar el registro histórico (`ATTEMPT#...`), comparar contra el `BEST#<scenarioId>` existente y actualizarlo si mejora, y recalcular `STATS.totalPoints` y `STATS.casesCompleted` del usuario.
- Implementar `getLeaderboard` leyendo el GSI ya ordenado por `totalPoints`.

**Prompt para el agente (ejemplo):**
> "Implementa `submitAttempt` para que calcule `accuracy` con `validateOrder`, guarde el intento histórico, actualice `BEST#<scenarioId>` solo si el nuevo accuracy es mayor, y recalcule `STATS.totalPoints` (suma de todos los BEST) y `STATS.casesCompleted`. No incluyas tiempo ni velocidad en ningún cálculo. Implementa `getLeaderboard` consultando el GSI con orden descendente por `totalPoints`. Añade tests cubriendo: primer intento de un caso, un reintento que mejora, un reintento que empeora (no debe bajar el best), y el recálculo de `totalPoints`."

**Criterios de aceptación:** `totalPoints` de un usuario es exactamente la suma de sus mejores `accuracy` por caso distinto; repetir un caso con peor resultado no baja el puntaje; resolver un caso nuevo siempre puede subir el puntaje total; el ranking se obtiene con una única query ordenada; nada en el cálculo depende del tiempo.

---

## Fase 7 — Seguridad, pruebas y validación pedagógica

**Objetivo:** que la herramienta enseñe protocolos correctos y sea segura.

**Tareas:**
- **Revisión de instructor** de los casos en `borrador` antes de publicarlos (esto ya es parte del flujo normal desde la Fase 4, no un paso aparte).
- **Aviso visible** de que es una herramienta de entrenamiento para practicar y memorizar la secuencia, no un sustituto de la instrucción certificada ni una evaluación formal.
- Confirmar que **no se introducen datos reales de pacientes**.
- Tests de integración de los endpoints y prueba de que el feedback de IA nunca contradice la secuencia validada, y de que ningún caso `borrador` es accesible desde `getPublishedScenario`.

**Criterios de aceptación:** el instructor puede revisar y publicar casos sin fricción; existe el disclaimer; los tests de integración pasan, incluyendo el que confirma que los borradores no son visibles.

---

## Fase 8 — Despliegue y piloto

**Objetivo:** poner la plataforma en manos de los voluntarios y medir.

**Tareas:**
- `cdk deploy` a un entorno de piloto.
- **Sembrar la librería inicial:** correr `generateScenarioBatch` manualmente una o varias veces antes del piloto para no arrancar con la librería vacía, y que un instructor revise y publique ese primer lote.
- Confirmar que la regla de EventBridge queda activa para que la librería siga creciendo cada noche durante el piloto.
- Piloto con el grupo (28 voluntarios × 20 intentos según tu estimación).
- Recoger métricas: `totalPoints` y `casesCompleted` por usuario, precisión promedio por caso, errores más comunes, coste real de Bedrock (generación batch + feedback).
- Iterar sobre las plantillas con el instructor.

**Criterios de aceptación:** los voluntarios completan intentos de extremo a extremo; la librería crece de una noche a otra sin perder los casos previos; el coste real se registra y se compara con lo estimado.

---

## Anexo — Plantilla del archivo de contexto del agente

Guárdalo como `CLAUDE.md` / `AGENTS.md` / `.cursorrules` en la raíz.

```markdown
# Contexto del proyecto — Plataforma de entrenamiento Cruz Roja

## Qué es
Plataforma serverless para que voluntarios practiquen el orden de evaluación
de pacientes (evaluación primaria → APH) ordenando pasos (drag & drop).
Es una herramienta de práctica y memorización, no una evaluación formal.
La librería de casos crece cada noche vía un batch acumulativo; un leaderboard
general por usuario premia resolver más casos y resolverlos bien.

## Regla de oro (INNEGOCIABLE)
- Nunca inventes ni modifiques protocolos médicos ni secuencias correctas.
- La fuente de verdad son los archivos validados en /domain.
- La IA solo genera narrativa y explica; nunca decide qué está bien.
- Ningún caso generado llega a un voluntario sin pasar por revisión
  (status: borrador -> revisado/publicado -> solo publicado es visible).
- Cualquier cambio en /domain requiere revisión de un instructor.

## Stack
- Infra: AWS CDK (TypeScript) — fijo, sin alternativas.
- Backend: Node.js + TypeScript, Lambda + API Gateway
- Datos: DynamoDB single-table (tablas Scenarios y Attempts;
  GSI de leaderboard ordenado por totalPoints)
- Generación programada: EventBridge Scheduler -> Lambda batch nocturna
- IA: Amazon Bedrock (SDK v3). Sonnet 4.6 para generar (batch inference),
      Haiku 4.5 para feedback. Prompt caching activo sobre el material instructivo.
- Frontend: Next.js + @dnd-kit (accesible por teclado y táctil)

## Cómo se puntúa (no cambiar sin discutirlo)
- accuracy del intento = pasos en posición correcta / total de pasos.
- Por cada caso solo cuenta el MEJOR intento del usuario (BEST#<scenarioId>).
- totalPoints del usuario = suma de esos mejores accuracy, uno por caso distinto.
- El leaderboard es GENERAL (no por caso, no por ciclo) y ordena por totalPoints.
- El tiempo NUNCA interviene en el cálculo.

## Convenciones
- TypeScript estricto. Funciones puras para la lógica de validación y puntuación.
- Tests unitarios antes de la implementación en módulos críticos.
- Incrementos pequeños; un cambio verificable por vez.
- Idioma de la UI y del contenido: español.

## No hacer
- No introducir datos reales de pacientes.
- No usar búsqueda vectorial; el contenido va inyectado en el prompt.
- No reemplazar ni vaciar la librería de casos en el batch nocturno: solo se agrega.
- No publicar un caso sin que pase por el estado "revisado".
- No incluir tiempo ni velocidad en el puntaje ni en el leaderboard.
```
