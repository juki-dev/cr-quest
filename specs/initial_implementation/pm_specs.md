# Requerimientos técnicos de implementación

## Plataforma de entrenamiento en valoración de pacientes — Cruz Roja

Backlog derivado de [Guia_Implementacion_Plataforma_PrimerosAuxilios.md](../Guia_Implementacion_Plataforma_PrimerosAuxilios.md) y de [mockup.html](../mockup.html). La guía describe el *proceso*; este documento lo convierte en *requerimientos ejecutables*: cada ítem tiene un identificador estable, una prioridad, sus dependencias y un criterio de aceptación verificable.

### Cómo leer este documento

| Elemento | Significado |
| :--- | :--- |
| `RQ-T.n` | Requerimiento transversal — aplica a todo el proyecto, no a una fase concreta. |
| `RQ-<fase>.<n>` | Requerimiento de una fase específica (0 a 8), en orden de ejecución. |
| **P0** | Bloquea el piloto. Sin esto no hay producto que probar. |
| **P1** | Necesario para que el piloto sea real y sostenible, no una demo. |
| **P2** | Post-piloto. Valioso, pero no condiciona la salida. |
| 🧑‍⚕️ | **Bloqueo humano.** Depende de una persona con formación certificada, no del equipo técnico ni de la IA. No se puede acelerar con más ingeniería. |

Las dependencias se expresan como `⟵ RQ-x.y`: el requerimiento no puede empezar hasta que esos estén cerrados.

---

## Decisiones resueltas

La guía original deja cuatro puntos abiertos que bloqueaban la implementación. Están cerrados y ya incorporados a los requerimientos de abajo:

| # | Decisión | Por qué |
| :--- | :--- | :--- |
| D1 | **Identidad con Amazon Cognito User Pool** (email + contraseña), con grupos `voluntario` e `instructor`, integrado a API Gateway como authorizer. | El spec usa `USER#<userId>` y el mockup muestra nombres en el ranking, pero nunca define autenticación. Sin identidad estable no hay leaderboard: el puntaje acumulado carece de dueño. Los grupos, además, son lo que protege el panel de revisión. |
| D2 | **Panel de revisión como pantalla web mínima en Next.js** (`/revision`), no consola ni CLI. | La compuerta `borrador → publicado` la opera un instructor, que no es perfil técnico. Si revisar exige la consola de DynamoDB, cada lote nocturno queda bloqueado esperando a alguien del equipo técnico. |
| D3 | **Manda el layout del mockup**: vista única de práctica con sidebar (progreso + top del ranking), y `/ranking` como página secundaria con la lista completa. | El mockup ya resuelve el flujo: el voluntario ve su posición sin abandonar la práctica. Reemplaza el "leaderboard como pantalla aparte" de la Fase 5, que partía el flujo en dos. |
| D4 | **Alcance completo de las 9 fases, priorizado P0/P1/P2.** | Permite recortar para el piloto con la lista entera a la vista, en vez de descubrir tarde lo que se dejó fuera. |

---

## RQ-T · Requerimientos transversales

Aplican a todas las fases. Se verifican de forma continua, no una sola vez.

- [ ] **RQ-T.1** · **P0** · 🧑‍⚕️ · **Regla de oro: la IA nunca define ni modifica la secuencia correcta.**
  La única fuente de verdad de qué orden es correcto son los archivos validados en `/domain`. La IA redacta narrativa y explica errores ya calculados por el motor de reglas.
  *Aceptación:* existe una prueba automatizada que, dado un escenario generado, verifica que su `correctSequence` es idéntica a la de la plantilla de origen. Ningún módulo que decida corrección importa el cliente de Bedrock.

- [ ] **RQ-T.2** · **P0** · **Todo el contenido y la UI en español.**
  Incluye narrativas generadas, etiquetas de pasos, feedback de IA, mensajes de error y el panel de revisión.
  *Aceptación:* revisión manual de cada pantalla; el prompt de generación fija el idioma explícitamente.

- [ ] **RQ-T.3** · **P0** · **TypeScript estricto en los cuatro paquetes.**
  `strict: true`, sin `any` implícito, sin `@ts-ignore` sin justificación en comentario.
  *Aceptación:* `pnpm build` pasa en limpio en `/infra`, `/backend`, `/frontend` y `/domain`.

- [ ] **RQ-T.4** · **P0** · **Prohibición de datos reales de pacientes.**
  Las narrativas son ficticias por construcción; no se ingiere ni almacena información clínica real.
  *Aceptación:* el prompt de generación lo prohíbe explícitamente; la revisión del instructor (RQ-4.4) lo incluye como criterio de rechazo.

- [ ] **RQ-T.5** · **P0** · **Disclaimer visible en la interfaz.**
  Texto permanente indicando que es una herramienta de práctica y memorización, no un sustituto de la instrucción certificada ni una evaluación formal.
  *Aceptación:* visible sin scroll en la pantalla de práctica y presente en el pie de `/ranking`.

- [ ] **RQ-T.6** · **P1** · **Lógica crítica implementada como funciones puras con tests previos.**
  Aplica al motor de validación (RQ-3) y al agregador de puntaje (RQ-6). Los tests se escriben antes que la implementación.
  *Aceptación:* ambos módulos son funciones sin efectos secundarios ni I/O; los commits muestran los tests antes del código.

- [ ] **RQ-T.7** · **P1** · **Observabilidad de coste de Bedrock.**
  Registrar tokens de entrada/salida y coste estimado por corrida de generación y por llamada de feedback, con etiquetas que permitan separar ambos flujos.
  *Aceptación:* tras una corrida nocturna se puede responder "cuánto costó este lote" desde CloudWatch, sin abrir la facturación de AWS.

- [ ] **RQ-T.8** · **P1** · **Presupuesto con alarma en la cuenta de AWS.**
  Límite mensual acordado y alerta al superar el umbral, para que un bucle de generación defectuoso no se descubra en la factura.
  *Aceptación:* la alarma existe y se ha probado disparándola con un umbral bajo temporal.

- [ ] **RQ-T.9** · **P2** · **Commits pequeños y reversibles, con marca explícita cuando el cambio toca contenido médico.**
  *Aceptación:* los PR que modifican `/domain` llevan etiqueta de revisión de instructor.

---

## RQ-0 · Preparación del entorno

**Objetivo:** repositorio y herramientas listos, sin lógica de negocio.

- [ ] **RQ-0.1** · **P0** · **Monorepo con pnpm workspaces y cuatro paquetes:** `/infra`, `/backend`, `/frontend`, `/domain`.
  *Aceptación:* `pnpm install` resuelve desde la raíz; cada paquete tiene su `package.json` y es importable desde los demás donde corresponda.

- [ ] **RQ-0.2** · **P0** · ⟵ RQ-0.1 · **Configuración compartida de TypeScript estricto, ESLint y Prettier a nivel raíz.**
  *Aceptación:* `pnpm lint` y `pnpm build` pasan sobre el proyecto vacío.

- [ ] **RQ-0.3** · **P0** · ⟵ RQ-0.1 · **Scripts raíz `lint`, `test` y `build`** que atraviesan todos los paquetes.
  *Aceptación:* los tres comandos corren desde la raíz y fallan si falla cualquier paquete.

- [ ] **RQ-0.4** · **P0** · **Archivo de contexto del agente (`CLAUDE.md`) en la raíz**, a partir de la plantilla del anexo de la guía, incorporando las decisiones D1–D4.
  *Aceptación:* el archivo existe, incluye la regla de oro, el stack fijo, la fórmula de puntaje y la sección "No hacer".

- [ ] **RQ-0.5** · **P0** · **Cuenta de AWS de pruebas con credenciales configuradas** y separada de cualquier entorno productivo.
  *Aceptación:* `cdk bootstrap` completa en esa cuenta.

- [ ] **RQ-0.6** · **P2** · **Pipeline de CI** que corra `lint`, `test` y `build` en cada PR.
  *Aceptación:* un PR con un test roto no se puede fusionar.

---

## RQ-1 · Dominio médico — la fuente de verdad

**Objetivo:** definir qué es "correcto" antes de programar nada que lo evalúe. Esta fase **la lidera un instructor certificado**; el equipo técnico solo transcribe y modela.

- [ ] **RQ-1.1** · **P0** · 🧑‍⚕️ · **Taxonomía de pasos de valoración** (valoración primaria → APH) como datos semilla.
  Cada paso: `stepId`, etiqueta en español, descripción y categoría.
  *Aceptación:* la lista está alineada al protocolo de la regional y firmada por el instructor. El mockup usa 6 pasos de ejemplo ([mockup.html:486-493](../mockup.html)); la taxonomía real puede tener más.

- [ ] **RQ-1.2** · **P0** · ⟵ RQ-1.1 · **Tipos TypeScript `AssessmentStep` y `ScenarioTemplate` en `/domain`.**
  `ScenarioTemplate` incluye tipo de caso, dificultad y `correctSequence` (lista ordenada de `stepId`).
  *Aceptación:* los tipos compilan y `correctSequence` solo admite `stepId` existentes en la taxonomía.

- [ ] **RQ-1.3** · **P0** · 🧑‍⚕️ · ⟵ RQ-1.2 · **Primer conjunto de plantillas con su secuencia correcta, revisado y firmado.**
  *Aceptación:* cada plantilla tiene `validatedBy` y `validatedAt` con valores reales, no marcadores. Se acuerda un mínimo de plantillas para que el batch nocturno tenga material suficiente sin repetirse de inmediato.

- [ ] **RQ-1.4** · **P0** · ⟵ RQ-1.3 · **Validación automática de los datos semilla contra el esquema.**
  *Aceptación:* existe un test que falla si una plantilla referencia un `stepId` inexistente, si `correctSequence` tiene duplicados, o si faltan los campos de validación.

- [ ] **RQ-1.5** · **P1** · **Los datos semilla viven versionados como archivos en `/domain`**, no en base de datos.
  *Aceptación:* cualquier cambio en una secuencia correcta queda en el historial de git y es atribuible.

- [ ] **RQ-1.6** · **P2** · **Procedimiento documentado para añadir o corregir plantillas** después del piloto, incluyendo quién firma.
  *Aceptación:* documento breve en `/domain` que un instructor puede seguir sin ayuda técnica.

---

## RQ-2 · Infraestructura serverless base

**Objetivo:** esqueleto desplegable con el modelo de datos que sostiene la librería creciente y el leaderboard general. Sin lógica de negocio aún.

### Datos

- [ ] **RQ-2.1** · **P0** · **Tabla `Scenarios` en DynamoDB** — la librería de casos.
  PK `SCENARIO#<id>`. Atributos: `templateId`, narrativa generada, `correctSequence`, `status` (`borrador` | `revisado` | `publicado` | `rechazado`), y auditoría `generatedAt`, `reviewedBy`, `reviewedAt`.
  *Aceptación:* la tabla se crea vía CDK y admite un ítem de cada estado.

- [ ] **RQ-2.2** · **P0** · **Índice para consultar escenarios por `status`.**
  `getPublishedScenario` debe poder leer solo los publicados sin escanear la tabla completa, y el panel de revisión debe listar los borradores igual de barato.
  *Aceptación:* ambas consultas se resuelven con `Query`, no con `Scan`, y su coste no crece con el tamaño de la librería.

- [ ] **RQ-2.3** · **P0** · **Tabla `Attempts` en diseño single-table**, particionada por usuario (PK `USER#<userId>`), con tres tipos de ítem:
  - `ATTEMPT#<timestamp>#<scenarioId>` — histórico: `submittedOrder`, `accuracy`, `scenarioId`.
  - `BEST#<scenarioId>` — mejor `accuracy` del usuario en ese caso.
  - `STATS` — agregados: `totalPoints`, `casesCompleted`, y el atributo `recordType = "STATS"`.
  *Aceptación:* los tres tipos conviven en la misma partición y se distinguen por prefijo de SK.

- [ ] **RQ-2.4** · **P0** · ⟵ RQ-2.3 · **GSI del leaderboard sobre `Attempts`:** partición constante `recordType`, ordenación numérica por `totalPoints`.
  El atributo `recordType` existe **solo** en los ítems `STATS`, de modo que el índice sea disperso y contenga una fila por usuario.
  *Aceptación:* una única `Query` descendente devuelve el ranking completo; los ítems `ATTEMPT#` y `BEST#` no aparecen en el índice.

### Identidad (D1 — no está en la guía original)

- [ ] **RQ-2.5** · **P0** · **Cognito User Pool** con registro por email y contraseña, y política de contraseñas razonable para voluntarios.
  *Aceptación:* un usuario puede registrarse, confirmar y autenticarse; el `sub` de Cognito es el `userId` que usa `Attempts`.

- [ ] **RQ-2.6** · **P0** · ⟵ RQ-2.5 · **Grupos `voluntario` e `instructor`.**
  Todo registro nuevo entra como `voluntario`; la promoción a `instructor` es manual y deliberada.
  *Aceptación:* el token incluye el grupo y se puede leer desde la Lambda.

- [ ] **RQ-2.7** · **P0** · ⟵ RQ-2.5 · **Authorizer de Cognito en API Gateway** protegiendo todos los endpoints.
  *Aceptación:* una petición sin token válido recibe 401 en todos los endpoints, sin excepción.

- [ ] **RQ-2.8** · **P0** · ⟵ RQ-2.6 · **`reviewScenario` restringido al grupo `instructor`.**
  La comprobación se hace en el backend, no solo ocultando la UI.
  *Aceptación:* un token de `voluntario` recibe 403 al invocar `reviewScenario`, aunque llame al endpoint directamente.

- [ ] **RQ-2.9** · **P1** · **Nombre visible del usuario para el ranking**, capturado en el registro y almacenado junto a `STATS`.
  *Aceptación:* el leaderboard puede renderizar nombre e iniciales ([mockup.html:410-448](../mockup.html)) sin una consulta adicional a Cognito por fila.

### Cómputo y orquestación

- [ ] **RQ-2.10** · **P0** · **Cinco Lambdas stub definidas en CDK:** `generateScenarioBatch`, `reviewScenario`, `getPublishedScenario`, `submitAttempt`, `getLeaderboard`.
  *Aceptación:* despliegan y responden; sin lógica interna todavía.

- [ ] **RQ-2.11** · **P0** · ⟵ RQ-2.10 · **API Gateway expone las Lambdas que lo requieren.**
  `generateScenarioBatch` **no** se expone por HTTP: la dispara únicamente el scheduler.
  *Aceptación:* no existe ruta pública que permita disparar la generación.

- [ ] **RQ-2.12** · **P0** · ⟵ RQ-2.10 · **Regla de EventBridge Scheduler** que invoca `generateScenarioBatch` una vez por noche, en un horario acordado y con zona horaria explícita.
  *Aceptación:* la regla queda programada y visible en la consola aunque la Lambda sea un stub.

- [ ] **RQ-2.13** · **P0** · **Permisos IAM de mínimo privilegio por Lambda.**
  `getPublishedScenario` no escribe; `getLeaderboard` solo lee el GSI; solo `generateScenarioBatch` invoca Bedrock.
  *Aceptación:* ninguna política usa `*` en acciones ni en recursos.

- [ ] **RQ-2.14** · **P1** · **`cdk synth` y `cdk deploy` verificados en la cuenta de pruebas.**
  *Aceptación:* la plantilla se sintetiza sin errores y todos los recursos se crean.

- [ ] **RQ-2.15** · **P1** · **Cola de mensajes fallidos (DLQ) para `generateScenarioBatch`** y alarma si la corrida nocturna falla.
  *Aceptación:* un fallo del batch genera una notificación; la librería no se queda silenciosamente sin crecer.

- [ ] **RQ-2.16** · **P2** · **Entornos separados de piloto y desarrollo** parametrizados en el stack.
  *Aceptación:* ambos se despliegan desde el mismo código sin editar constantes.

---

## RQ-3 · Motor de validación determinista

**Objetivo:** comparar el orden del usuario contra la secuencia correcta, sin IA, de forma rápida y reproducible.

- [ ] **RQ-3.1** · **P0** · ⟵ RQ-1.2 · **Función pura `validateOrder(submitted, correct)`** en `/backend/domain` que devuelve `{ accuracy, misplacedSteps }`.
  Fórmula: `accuracy = pasos en la posición correcta ÷ total de pasos de la respuesta`. Comparación posición por posición; una omisión corre los pasos siguientes y estos cuentan como mal colocados, sin castigo adicional.
  *Aceptación:* la función no hace I/O, no lee del entorno y es determinista para la misma entrada.

- [ ] **RQ-3.2** · **P0** · ⟵ RQ-3.1 · **Tests unitarios escritos antes de la implementación**, cubriendo como mínimo:
  orden perfecto · orden completamente invertido · dos pasos intercambiados · lista incompleta · lista con un paso omitido al inicio · lista con un `stepId` repetido · lista vacía · lista más larga que la correcta.
  *Aceptación:* todos pasan y la cobertura del módulo es alta.

- [ ] **RQ-3.3** · **P0** · ⟵ RQ-3.1 · **Cero llamadas a IA en este módulo.**
  *Aceptación:* el paquete no depende de `@aws-sdk/client-bedrock-runtime`; verificable revisando sus imports.

- [ ] **RQ-3.4** · **P0** · ⟵ RQ-3.1 · **`accuracy` es el valor único que fluye al resto del sistema:** se guarda en `ATTEMPT#` y compite por convertirse en el nuevo `BEST#<scenarioId>`.
  *Aceptación:* ninguna otra parte del código recalcula la exactitud por su cuenta.

---

## RQ-4 · Generación nocturna, revisión e IA

**Objetivo:** una librería que crece cada noche, con una compuerta de revisión antes de que cualquier caso llegue a un voluntario, y feedback siempre anclado a los datos validados.

### Generación

- [ ] **RQ-4.1** · **P0** · ⟵ RQ-1.3, RQ-2.12 · **`generateScenarioBatch` toma N plantillas de `/domain` y pide a Bedrock únicamente la narrativa del paciente.**
  El modelo nunca recibe la instrucción de ordenar pasos ni de proponer una secuencia.
  *Aceptación:* el `correctSequence` del escenario guardado es copia literal del de la plantilla; una prueba lo verifica sobre la salida real del batch.

- [ ] **RQ-4.2** · **P0** · ⟵ RQ-4.1 · **La generación es acumulativa: nunca borra, vacía ni sobreescribe casos existentes.**
  Cada caso nuevo se guarda con `status = borrador`.
  *Aceptación:* tras dos corridas consecutivas, el número de escenarios crece y ningún caso previo cambió de estado ni de contenido.

- [ ] **RQ-4.3** · **P1** · ⟵ RQ-4.1 · **El identificador del modelo se resuelve desde configuración, nunca hardcodeado en el código.**
  La guía es explícita: consultar el ID vigente en la consola de Bedrock. La generación usa el modelo de mayor calidad narrativa; el feedback, uno más económico.
  *Aceptación:* cambiar de modelo no requiere tocar código ni redesplegar la lógica, solo la configuración.

- [ ] **RQ-4.4** · **P1** · ⟵ RQ-4.1 · **Uso de la API de batch inference de Bedrock** para la generación nocturna, aprovechando que ya se generan varios casos de una vez.
  *Aceptación:* la corrida nocturna usa el modo batch y su coste por caso es medible y menor que on-demand.

- [ ] **RQ-4.5** · **P1** · ⟵ RQ-4.1 · **Prompt caching activo sobre el material instructivo** inyectado en generación y en feedback, que es idéntico en cada llamada.
  *Aceptación:* las métricas de tokens muestran lectura desde caché tras la primera llamada de cada ciclo.

- [ ] **RQ-4.6** · **P1** · ⟵ RQ-4.1 · **Manejo de fallos parciales del lote.**
  Si la generación falla para una plantilla, las demás se guardan igual y el fallo queda registrado.
  *Aceptación:* un error simulado en una plantilla no impide que el resto del lote llegue a `borrador`.

- [ ] **RQ-4.7** · **P2** · ⟵ RQ-4.1 · **Rotación de plantillas entre corridas** para que el lote de cada noche no repita siempre las mismas.
  *Aceptación:* dos noches seguidas producen escenarios de plantillas distintas mientras haya material disponible.

### Compuerta de revisión

- [ ] **RQ-4.8** · **P0** · ⟵ RQ-2.8 · **`reviewScenario` transiciona un caso de `borrador` a `publicado` o `rechazado`**, registrando `reviewedBy` y `reviewedAt`.
  *Aceptación:* las transiciones inválidas (p. ej. publicar un caso ya rechazado) se rechazan con error explícito.

- [ ] **RQ-4.9** · **P0** · ⟵ RQ-4.8 · **Ningún caso alcanza `publicado` sin pasar por `reviewScenario`.**
  *Aceptación:* `generateScenarioBatch` no tiene permiso ni ruta de código para escribir `status: publicado`.

- [ ] **RQ-4.10** · **P1** · ⟵ RQ-4.8 · **El instructor puede corregir la narrativa antes de publicar.**
  La secuencia correcta **no** es editable desde el panel: vive en `/domain`.
  *Aceptación:* editar y publicar guarda la narrativa corregida; no existe ruta para alterar `correctSequence` desde la API de revisión.

### Entrega y feedback

- [ ] **RQ-4.11** · **P0** · ⟵ RQ-2.2 · **`getPublishedScenario` devuelve un caso entre los `publicado`**, elegido al azar o priorizando el menos practicado por ese usuario.
  Es una lectura: no hay generación en tiempo real por intento.
  *Aceptación:* la respuesta nunca incluye un caso en `borrador`, `revisado` ni `rechazado`, y no invoca a Bedrock.

- [ ] **RQ-4.12** · **P0** · ⟵ RQ-4.11 · **La respuesta a `getPublishedScenario` no expone la secuencia correcta al cliente.**
  El navegador recibe la narrativa y los pasos desordenados; la corrección ocurre en el servidor.
  *Aceptación:* inspeccionar la respuesta de red no revela el orden correcto.

- [ ] **RQ-4.13** · **P0** · ⟵ RQ-3.1 · **Feedback de IA anclado (*grounded*):** el prompt incluye la secuencia correcta, el orden enviado y los pasos mal colocados que ya calculó el motor de reglas. La IA solo explica *por qué*, nunca juzga si está bien.
  *Aceptación:* el feedback siempre cita pasos provenientes de `misplacedSteps`; una prueba verifica que el modelo no puede alterar el `accuracy` mostrado.

- [ ] **RQ-4.14** · **P1** · ⟵ RQ-4.13 · **Degradación elegante si Bedrock falla en el feedback.**
  El voluntario ve igualmente su porcentaje y sus pasos mal colocados, con la explicación ausente.
  *Aceptación:* con el feedback de IA deshabilitado, el intento se guarda y el resultado se muestra completo salvo la explicación.

---

## RQ-5 · Frontend

**Objetivo:** la interfaz del [mockup](../mockup.html), implementada en Next.js con accesibilidad real (D3).

### Pantalla de práctica

- [ ] **RQ-5.1** · **P0** · ⟵ RQ-4.11 · **Vista principal según el mockup:** narrativa del caso en una tarjeta superior, y debajo el área de trabajo con dos columnas — pool de pasos disponibles y secuencia con slots numerados ([mockup.html:351-382](../mockup.html)).
  *Aceptación:* la disposición reproduce el mockup en escritorio y colapsa a una columna en móvil.

- [ ] **RQ-5.2** · **P0** · ⟵ RQ-5.1 · **Drag and drop con @dnd-kit** para llevar pasos del pool a los slots y reordenarlos.
  *Aceptación:* funciona con ratón; un paso soltado sobre un slot ocupado devuelve el anterior al pool, como en el mockup.

- [ ] **RQ-5.3** · **P0** · ⟵ RQ-5.2 · **Operación completa por teclado.**
  El mockup ya lo insinúa con `tabIndex` y Enter/Espacio para colocar en el siguiente slot libre ([mockup.html:521-523](../mockup.html)); dnd-kit debe cubrirlo de forma nativa y anunciada.
  *Aceptación:* un escenario se puede resolver y enviar sin tocar el ratón, con foco visible en todo momento.

- [ ] **RQ-5.4** · **P0** · ⟵ RQ-5.2 · **Arrastre táctil en móvil.**
  *Aceptación:* un escenario se completa en un teléfono real, sin que el gesto de arrastre haga scroll de la página.

- [ ] **RQ-5.5** · **P0** · ⟵ RQ-5.1 · **Validación previa al envío:** no se envía con slots vacíos, y el aviso lo explica ([mockup.html:585-588](../mockup.html)).
  *Aceptación:* el intento incompleto no llega al backend y el mensaje indica qué falta.

- [ ] **RQ-5.6** · **P0** · ⟵ RQ-6.1 · **Envío a `submitAttempt` y presentación del resultado:** porcentaje de coincidencia, cuántos pasos de cuántos quedaron en su sitio, marcado visual de slots correctos e incorrectos, y la explicación de la IA ([mockup.html:590-597](../mockup.html)).
  *Aceptación:* tras enviar, los slots se colorean y el porcentaje coincide con el que calculó el backend.

- [ ] **RQ-5.7** · **P1** · **Botón "Limpiar"** que reinicia los slots y devuelve los pasos al pool en orden aleatorio.
  *Aceptación:* replica el comportamiento del mockup ([mockup.html:600-606](../mockup.html)).

- [ ] **RQ-5.8** · **P1** · ⟵ RQ-5.6 · **Pasar al siguiente caso** sin recargar la página.
  *Aceptación:* tras ver el feedback, una acción trae un caso nuevo y reinicia el área de trabajo.

### Progreso y ranking

- [ ] **RQ-5.9** · **P0** · ⟵ RQ-6.2 · **Tarjeta de progreso en el sidebar:** puntos totales, casos completados y posición en el ranking general ([mockup.html:386-404](../mockup.html)).
  *Aceptación:* los valores coinciden con `STATS` y se actualizan tras un intento que mejora la marca.

- [ ] **RQ-5.10** · **P0** · ⟵ RQ-6.2 · **Top del ranking general en el sidebar**, con posición, iniciales, nombre, casos resueltos y puntos; la fila del usuario actual destacada aunque esté fuera del top ([mockup.html:406-479](../mockup.html)).
  *Aceptación:* reproduce el mockup, incluida la leyenda "Puntos = suma del mejor acierto por cada caso resuelto".

- [ ] **RQ-5.11** · **P1** · ⟵ RQ-6.2 · **Página `/ranking` con la lista completa de voluntarios** ordenada por `totalPoints`, mostrando también `casesCompleted`.
  *Aceptación:* con 28 voluntarios se ven todos; la posición del usuario actual sigue destacada.

### Panel de revisión (D2)

- [ ] **RQ-5.12** · **P0** · ⟵ RQ-2.8, RQ-4.8 · **Ruta `/revision` accesible solo al grupo `instructor`**, con la lista de casos en `borrador`.
  *Aceptación:* un `voluntario` que navega a la ruta no ve contenido; el backend rechaza igualmente sus peticiones.

- [ ] **RQ-5.13** · **P0** · ⟵ RQ-5.12 · **Detalle de revisión:** narrativa generada y secuencia correcta de la plantilla, lado a lado, con acciones **Publicar** y **Rechazar**.
  *Aceptación:* un instructor procesa un lote nocturno completo sin ayuda técnica ni acceso a la consola de AWS.

- [ ] **RQ-5.14** · **P1** · ⟵ RQ-5.13 · **Edición de la narrativa antes de publicar** (RQ-4.10), con la secuencia correcta en modo lectura.
  *Aceptación:* la secuencia no es editable por ningún medio desde esta pantalla.

### Acceso y transversales de UI

- [ ] **RQ-5.15** · **P0** · ⟵ RQ-2.5 · **Pantallas de registro e inicio de sesión** integradas con Cognito, en español.
  *Aceptación:* un voluntario nuevo se registra y llega a la pantalla de práctica sin intervención manual.

- [ ] **RQ-5.16** · **P1** · **Diseño responsivo y respeto de `prefers-reduced-motion`**, como ya hace el mockup ([mockup.html:25-27](../mockup.html)).
  *Aceptación:* la interfaz es usable entre 360 px y escritorio; con movimiento reducido activo no hay transiciones.

- [ ] **RQ-5.17** · **P1** · **Estados de carga y error visibles** en obtención de caso, envío de intento y ranking.
  *Aceptación:* ningún fallo de red deja la pantalla en blanco o congelada sin explicación.

- [ ] **RQ-5.18** · **P2** · **Identidad visual de Cruz Roja** siguiendo la paleta del mockup ([mockup.html:10-21](../mockup.html)).
  *Aceptación:* los colores y tipografías se definen como tokens reutilizables, no repartidos por los componentes.

---

## RQ-6 · Puntuación y leaderboard

**Objetivo:** un puntaje acumulado que premia resolver **más** casos y resolverlos **bien**. El tiempo no interviene en ningún cálculo.

- [ ] **RQ-6.1** · **P0** · ⟵ RQ-3.1, RQ-2.3 · **`submitAttempt` ejecuta la secuencia completa:**
  1. calcula `accuracy` con `validateOrder`;
  2. guarda el registro histórico `ATTEMPT#<timestamp>#<scenarioId>`;
  3. actualiza `BEST#<scenarioId>` **solo si el nuevo `accuracy` es mayor**;
  4. recalcula `STATS.totalPoints` (suma de todos los `BEST`) y `STATS.casesCompleted` (casos distintos intentados).
  *Aceptación:* `totalPoints` es exactamente la suma de los mejores `accuracy` por caso distinto, comprobado sobre datos reales.

- [ ] **RQ-6.2** · **P0** · ⟵ RQ-2.4 · **`getLeaderboard` lee el GSI ya ordenado**, con una única `Query` descendente por `totalPoints`.
  Devuelve nombre, `totalPoints` y `casesCompleted` por usuario.
  *Aceptación:* la operación no escanea la tabla y su latencia no crece con el histórico de intentos.

- [ ] **RQ-6.3** · **P0** · ⟵ RQ-6.1 · **El tiempo no participa en ningún cálculo.**
  Ni velocidad de resolución, ni bonus por rapidez, ni decaimiento por antigüedad.
  *Aceptación:* revisión del código de puntaje; el único uso de timestamps es como clave del histórico.

- [ ] **RQ-6.4** · **P0** · ⟵ RQ-6.1 · **Tests del agregador**, cubriendo:
  primer intento de un caso · reintento que mejora (sube `BEST` y `totalPoints`) · reintento que empeora (**no** baja `BEST` ni `totalPoints`) · caso nuevo resuelto (`casesCompleted` +1) · recálculo de `totalPoints` sobre varios casos.
  *Aceptación:* todos pasan; repetir un caso con peor resultado nunca reduce el puntaje.

- [ ] **RQ-6.5** · **P1** · ⟵ RQ-6.1 · **Actualización atómica de `STATS`** frente a intentos concurrentes del mismo usuario.
  *Aceptación:* dos envíos simultáneos no dejan `totalPoints` desincronizado respecto a los `BEST` almacenados.

- [ ] **RQ-6.6** · **P1** · ⟵ RQ-6.1 · **`casesCompleted` cuenta casos distintos, no intentos.**
  *Aceptación:* resolver el mismo caso cinco veces deja el contador en 1.

- [ ] **RQ-6.7** · **P2** · **Herramienta de recálculo de `STATS` desde los `BEST`**, para reparar divergencias sin rehacer el histórico.
  *Aceptación:* ejecutarla sobre un usuario sano no cambia sus valores.

---

## RQ-7 · Seguridad, pruebas y validación pedagógica

**Objetivo:** que la herramienta enseñe protocolos correctos y no exponga lo que no debe.

- [ ] **RQ-7.1** · **P0** · ⟵ RQ-4.11 · **Prueba de que ningún caso `borrador`, `revisado` ni `rechazado` es accesible desde `getPublishedScenario`**, ni siquiera solicitándolo por identificador directo.
  *Aceptación:* el test de integración pasa y falla si alguien relaja el filtro de `status`.

- [ ] **RQ-7.2** · **P0** · ⟵ RQ-4.13 · **Prueba de que el feedback de IA nunca contradice la secuencia validada.**
  *Aceptación:* sobre un conjunto de intentos con errores conocidos, la explicación siempre coincide con los pasos que marcó el motor de reglas.

- [ ] **RQ-7.3** · **P0** · ⟵ RQ-2.7 · **Tests de integración de todos los endpoints**, incluyendo los casos de autorización: sin token, token de rol incorrecto, token válido.
  *Aceptación:* la suite corre contra el entorno desplegado y cubre los cinco endpoints.

- [ ] **RQ-7.4** · **P0** · ⟵ RQ-T.5 · **Disclaimer presente y verificado** en la interfaz.
  *Aceptación:* comprobado en la revisión previa al piloto.

- [ ] **RQ-7.5** · **P0** · 🧑‍⚕️ · ⟵ RQ-4.8 · **Revisión de instructor operando como parte del flujo normal**, no como paso excepcional previo al lanzamiento.
  *Aceptación:* el instructor ha revisado al menos un lote nocturno completo antes del piloto y confirma que el proceso no le genera fricción.

- [ ] **RQ-7.6** · **P1** · **Confirmación de que no se introducen datos reales de pacientes** en ninguna narrativa publicada.
  *Aceptación:* incluido explícitamente en los criterios de rechazo del panel de revisión.

- [ ] **RQ-7.7** · **P1** · ⟵ RQ-2.11 · **Límites de tasa en los endpoints públicos**, en particular `submitAttempt`.
  *Aceptación:* un cliente que envía intentos en bucle recibe 429 y no infla su puntaje ni el coste de Bedrock.

- [ ] **RQ-7.8** · **P1** · **Registro de auditoría de las decisiones de publicación:** quién publicó o rechazó qué y cuándo.
  *Aceptación:* trazable desde los campos `reviewedBy` / `reviewedAt` de cada escenario.

- [ ] **RQ-7.9** · **P2** · **Revisión de seguridad de las políticas IAM y del user pool** antes de abrir el piloto.
  *Aceptación:* checklist completado y hallazgos cerrados.

---

## RQ-8 · Despliegue y piloto

**Objetivo:** poner la plataforma en manos de los voluntarios y medir.

- [ ] **RQ-8.1** · **P0** · ⟵ RQ-2.14 · **`cdk deploy` al entorno de piloto** con todos los recursos y el scheduler activo.
  *Aceptación:* el despliegue completa y la aplicación es alcanzable desde internet.

- [ ] **RQ-8.2** · **P0** · ⟵ RQ-4.1 · **Siembra de la librería inicial:** ejecutar `generateScenarioBatch` manualmente una o varias veces antes del piloto para no arrancar con la librería vacía.
  *Aceptación:* existe un número acordado de casos en `borrador` listos para revisar.

- [ ] **RQ-8.3** · **P0** · 🧑‍⚕️ · ⟵ RQ-8.2 · **Revisión y publicación del primer lote** por parte del instructor.
  *Aceptación:* hay suficientes casos `publicado` para que 28 voluntarios hagan ~20 intentos sin agotar la variedad.

- [ ] **RQ-8.4** · **P0** · ⟵ RQ-2.5 · **Alta de los 28 voluntarios** con instrucciones de acceso en español.
  *Aceptación:* todos pueden iniciar sesión antes del arranque del piloto.

- [ ] **RQ-8.5** · **P0** · ⟵ RQ-2.12 · **Confirmación de que la regla de EventBridge sigue activa** durante el piloto y la librería crece de una noche a otra.
  *Aceptación:* el recuento de escenarios aumenta entre dos días consecutivos y **ningún caso previamente publicado desaparece o cambia**.

- [ ] **RQ-8.6** · **P1** · ⟵ RQ-8.4 · **Recolección de métricas del piloto:** `totalPoints` y `casesCompleted` por usuario, precisión promedio por caso, pasos con más errores, y coste real de Bedrock separando generación y feedback.
  *Aceptación:* las métricas se pueden extraer sin consultas manuales a DynamoDB.

- [ ] **RQ-8.7** · **P1** · ⟵ RQ-8.6 · **Comparación del coste real contra lo estimado**, documentada.
  *Aceptación:* existe la cifra y la desviación explicada.

- [ ] **RQ-8.8** · **P1** · 🧑‍⚕️ · ⟵ RQ-8.6 · **Iteración sobre las plantillas con el instructor** a partir de los errores más frecuentes.
  *Aceptación:* al menos una ronda de ajuste ejecutada durante el piloto.

- [ ] **RQ-8.9** · **P2** · **Canal de retroalimentación para los voluntarios** dentro de la propia herramienta.
  *Aceptación:* un voluntario puede reportar un caso confuso sin salir de la plataforma.

---

## Mapa de dependencias

El camino crítico corre por RQ-1 → RQ-2 → RQ-3/RQ-4 → RQ-6 → RQ-5 → RQ-8.

| Bloque | Depende de | Habilita |
| :--- | :--- | :--- |
| **RQ-0** Entorno | — | Todo |
| **RQ-1** Dominio 🧑‍⚕️ | RQ-0 | RQ-3, RQ-4, RQ-6 |
| **RQ-2** Infraestructura | RQ-0 | Todo el backend y el acceso |
| **RQ-3** Validación | RQ-1 | RQ-4 (feedback), RQ-6 |
| **RQ-4** Generación y revisión | RQ-1, RQ-2, RQ-3 | RQ-5, RQ-7, RQ-8 |
| **RQ-5** Frontend | RQ-2 (auth), RQ-4, RQ-6 | RQ-8 |
| **RQ-6** Puntaje | RQ-2 (tablas y GSI), RQ-3 | RQ-5 (sidebar y ranking) |
| **RQ-7** Seguridad y pruebas | RQ-4, RQ-6 | RQ-8 |
| **RQ-8** Piloto | Todo lo anterior | — |

**Dos advertencias sobre la ruta crítica:**

1. **RQ-1 es el cuello de botella real y no es técnico.** Hasta que un instructor firme la taxonomía y las plantillas, RQ-3, RQ-4 y RQ-6 no tienen contra qué validarse. Conviene arrancarlo en paralelo con RQ-0, no después.
2. **RQ-2 concentra el riesgo de rehacer trabajo.** El diseño single-table y el GSI disperso son difíciles de cambiar una vez que hay datos de voluntarios; merecen revisión cuidadosa antes de desplegar.

---

## Riesgos y decisiones abiertas

Puntos que la guía no resuelve y que conviene cerrar **antes** de llegar a la fase correspondiente.

| # | Decisión pendiente | Cuándo decidir | Por qué importa |
| :--- | :--- | :--- | :--- |
| A1 | **Cuántos casos genera cada corrida nocturna.** | Antes de RQ-4.1 | Define el coste recurrente de Bedrock y, sobre todo, la carga de revisión del instructor. Un lote demasiado grande convierte la compuerta de calidad en un cuello de botella humano. |
| A2 | **Política de selección de caso:** aleatorio puro o "el menos practicado por ese usuario". | Antes de RQ-4.11 | La segunda opción enseña más y evita repeticiones frustrantes, pero exige consultar los `BEST#` del usuario antes de elegir. Con 28 voluntarios el coste es despreciable; conviene decidirlo antes de escribir la consulta. |
| A3 | **Qué ocurre si se detecta un error en un caso ya publicado.** | Antes de RQ-4.8 | Hace falta una transición `publicado → retirado` y una decisión sobre los puntos ya obtenidos en ese caso. Recomendación: retirar el caso pero conservar los puntos, para no penalizar al voluntario por un fallo del sistema. |
| A4 | **El ranking muestra nombre real o alias.** | Antes de RQ-2.9 | Afecta a qué se pide en el registro y a la percepción del leaderboard. En un grupo de 28 voluntarios que se conocen, el nombre real motiva más; el alias reduce la presión sobre quien va último. |
| A5 | **Mínimo de plantillas validadas para arrancar.** | Antes de RQ-1.3 | Con pocas plantillas, 28 voluntarios × 20 intentos agotan la variedad y empiezan a reconocer casos, lo que degrada el ejercicio a memorizar narrativas en vez de protocolo. |
| A6 | **Umbral de coste que dispara la alarma.** | Antes de RQ-T.8 | Sin una cifra acordada, la alarma no se configura y el primer aviso llega en la factura. |

---

## Cómo verificar que este backlog está completo

1. **Cobertura del spec:** cada una de las 9 fases de la guía tiene su bloque `RQ-<n>`, y cada tarea y criterio de aceptación del original está representado en al menos un requerimiento.
2. **Cobertura del mockup:** narrativa, pool de pasos, slots numerados, feedback con porcentaje y coloreado, tarjeta de progreso y ranking tienen su requerimiento en RQ-5.
3. **Decisiones incorporadas:** D1 aparece en RQ-2.5 a RQ-2.9 y RQ-5.15; D2 en RQ-5.12 a RQ-5.14; D3 en RQ-5.9 a RQ-5.11; D4 en la prioridad de cada casilla.
4. **Integridad de referencias:** toda casilla tiene ID, prioridad y criterio de aceptación, y ninguna dependencia apunta a un identificador inexistente.
