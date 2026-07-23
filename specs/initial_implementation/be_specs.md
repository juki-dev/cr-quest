# Especificación técnica — Backend & Infraestructura

Traduce [pm_specs.md](pm_specs.md) en decisiones de arquitectura y tareas de implementación concretas para `/backend`, `/infra` y `/domain`. Donde el análisis técnico encontró un vacío o un riesgo que pm_specs no cubre por ser un documento de producto, queda marcado como **🔎 Hallazgo** — son las correcciones que un TL debe hacer antes de que el equipo empiece a picar código, no cambios al alcance acordado con el usuario.

Convención de IDs: `BE-<área>.<n>`. Prioridad y trazabilidad (`⟵ RQ-x.y`) igual que en pm_specs.

---

## 1. Decisiones de arquitectura (ADR-lite)

### ADR-1 · Runtime y bundling de Lambda
**Decisión:** Node.js 20.x, arquitectura `arm64` (Graviton, ~20% más barato), bundling con `NodejsFunction` de CDK (esbuild), un entry point por handler en `/backend/src/handlers/*.ts`.
**Por qué:** esbuild vía CDK evita configurar un bundler aparte; arm64 es gratis en rendimiento para cargas I/O-bound como estas.

### ADR-2 · API Gateway HTTP API (v2), no REST API (v1)
**Decisión:** HTTP API con **JWT authorizer nativo** apuntando al Cognito User Pool.
**Por qué:** más barato, y el authorizer de JWT es de configuración declarativa — no hace falta escribir un Lambda authorizer a mano para validar tokens de Cognito.
**Alternativa descartada:** REST API v1 con Lambda authorizer custom — más control, pero es complejidad que este proyecto no necesita.

### ADR-3 · 🔎 Hallazgo: la API de batch inference de Bedrock es asíncrona — requiere un Lambda adicional a los 5 de RQ-2.10
`CreateModelInvocationJob` no devuelve las narrativas: encola un job que lee prompts desde S3 y escribe resultados en S3, con una duración de minutos a horas. Ninguna Lambda (máx. 15 min) puede esperarlo de forma síncrona dentro de la misma invocación que la dispara.
**Decisión:** dividir `generateScenarioBatch` (RQ-4.1) en dos unidades de cómputo:
- **`submitScenarioBatch`** (la Lambda que dispara EventBridge Scheduler, RQ-2.12): arma el archivo de prompts en JSONL, lo sube a S3, llama `CreateModelInvocationJob`, y registra el job como pendiente (ver BE-IA.3).
- **`ingestScenarioBatch`** (Lambda nueva, no contemplada en RQ-2.10): se dispara cuando el job termina, lee el S3 de salida, y escribe cada escenario en `Scenarios` con `status: borrador`.
**Mecanismo de disparo de `ingestScenarioBatch`:** Bedrock emite el estado de los jobs de batch inference a EventBridge. Se debe verificar en la documentación vigente de Bedrock el `detail-type` exacto del evento de cambio de estado en el momento de implementar (no fijarlo de memoria); como red de seguridad, añadir una regla de EventBridge Scheduler adicional cada 15 minutos que invoque `ingestScenarioBatch` en modo "revisa jobs pendientes y sus estados vía `GetModelInvocationJob`" si el evento nativo no llega en un tiempo razonable.
**Impacto en pm_specs:** RQ-2.10 y RQ-2.12 deben leerse como "6 Lambdas", no 5. Se documenta aquí en vez de reabrir pm_specs porque es un detalle de implementación, no una decisión de producto.

### ADR-4 · Validación de entrada con Zod
**Decisión:** todo body de request y toda respuesta de Bedrock que se parsea se valida con esquemas Zod en `/backend/src/schemas`. Un input que no valida devuelve `400` con el detalle del campo, nunca llega a la capa de dominio.
**Por qué:** falla rápido y con mensaje útil; evita `any` implícitos prohibidos por RQ-T.3.

### ADR-5 · Persistencia con `@aws-sdk/lib-dynamodb` y un repositorio por tabla
**Decisión:** `DynamoDBDocumentClient` (marshalling automático), un módulo `scenariosRepo.ts` y `attemptsRepo.ts` en `/backend/src/repositories`. Los handlers nunca llaman al SDK de DynamoDB directamente.
**Por qué:** aísla el modelo de acceso a datos de la lógica HTTP; facilita testear con `aws-sdk-client-mock`.

### ADR-6 · Testing con Vitest
**Decisión:** Vitest para unitarios y de integración (contra DynamoDB Local en Docker); `aws-cdk-lib/assertions` para tests de infraestructura.
**Por qué:** nativo en ESM/TS, arranca más rápido que Jest, mismo runner para los cuatro paquetes.

### ADR-7 · Nomenclatura: dos "dominios" que no deben confundirse
`/domain` (paquete de workspace, `@cr-quest/domain`) contiene los **datos semilla** (RQ-1: pasos, plantillas, `correctSequence`) y se importa como dependencia. `validateOrder` (RQ-3.1) vive en `/backend/src/domain/validateOrder.ts` — un módulo interno del backend, no el paquete. Son cosas distintas con el mismo nombre por el spec original; se documenta para que nadie intente importar `validateOrder` desde `@cr-quest/domain`.

### ADR-8 · Gestión de configuración de modelos Bedrock
**Decisión:** IDs de modelo en **SSM Parameter Store** (`/cr-quest/<stage>/bedrock/model-id/generacion`, `/cr-quest/<stage>/bedrock/model-id/feedback`), leídos una vez por cold start y cacheados en memoria del proceso (usar `@aws-lambda-powertools/parameters` para el caching con TTL, no `GetParameter` en cada invocación — evita throttling de SSM bajo carga).
**Por qué:** cumple RQ-4.3 (nunca hardcodear el ID) sin necesitar un redeploy para cambiar de modelo.

---

## 2. Estructura de paquetes

```
/domain
  src/steps.ts          # AssessmentStep[] semilla (RQ-1.1)
  src/templates.ts       # ScenarioTemplate[] semilla, con correctSequence (RQ-1.2, RQ-1.3)
  src/types.ts           # interfaces compartidas
  src/schema.test.ts      # RQ-1.4: valida referencias e integridad

/backend
  src/handlers/           # un archivo por Lambda, solo adaptación HTTP <-> dominio
    getPublishedScenario.ts
    submitAttempt.ts
    getLeaderboard.ts
    reviewScenarios.ts     # list (GET) + acción (PATCH), mismo handler, branch por método
    submitScenarioBatch.ts
    ingestScenarioBatch.ts
  src/domain/
    validateOrder.ts       # RQ-3.1, función pura
    scoring.ts             # RQ-6.1, agregador de STATS/BEST
  src/repositories/
    scenariosRepo.ts
    attemptsRepo.ts
  src/ia/
    bedrockClient.ts
    prompts/generacion.ts
    prompts/feedback.ts
  src/schemas/             # Zod, uno por endpoint
  src/config.ts            # lectura de SSM cacheada

/infra
  lib/data-stack.ts        # DynamoDB + S3 (batch I/O)
  lib/auth-stack.ts        # Cognito
  lib/api-stack.ts         # HTTP API + Lambdas + EventBridge + IAM
  bin/app.ts
```

- [ ] **BE-PKG.1** · P0 · ⟵ RQ-0.1 · Cuatro paquetes con `package.json` propio, `@cr-quest/domain` consumible como dependencia de workspace desde `/backend`.
  *Aceptación:* `pnpm --filter backend build` resuelve el import de `@cr-quest/domain` sin path relativo cruzando paquetes.

---

## 3. Modelo de datos

### Tabla `Scenarios`

| Atributo | Tipo | Notas |
| :--- | :--- | :--- |
| `PK` | S | `SCENARIO#<scenarioId>` |
| `templateId` | S | referencia a `/domain` |
| `narrative` | S | generada por Bedrock |
| `correctSequence` | List\<S\> | copia exacta de la plantilla, nunca generada por IA |
| `status` | S | `borrador` \| `revisado` \| `publicado` \| `rechazado` |
| `generatedAt` | S (ISO) | |
| `reviewedBy` / `reviewedAt` | S | ausentes hasta la revisión |
| `batchJobId` | S | trazabilidad al job de Bedrock que lo generó |

- [ ] **BE-DATA.1** · P0 · ⟵ RQ-2.1 · Definir tabla con `PK` como partition key simple, sin sort key.

- [ ] **BE-DATA.2** · P0 · ⟵ RQ-2.2 · **GSI `GSI1`**: partition key `status`, sort key `generatedAt`. Proyección `ALL` (el panel de revisión necesita `narrative` y `correctSequence` completos).
  *Aceptación:* `Query` por `status = 'publicado'` y por `status = 'borrador'` no usan `Scan`.

### Tabla `Attempts` (single-table)

| Ítem | `PK` | `SK` | Atributos propios |
| :--- | :--- | :--- | :--- |
| Histórico | `USER#<userId>` | `ATTEMPT#<isoTimestamp>#<scenarioId>` | `submittedOrder`, `accuracy`, `scenarioId` |
| Mejor marca | `USER#<userId>` | `BEST#<scenarioId>` | `accuracy`, `submittedOrder`, `updatedAt` |
| Agregado | `USER#<userId>` | `STATS` | `totalPoints`, `casesCompleted`, `displayName`, `recordType = "STATS"` |

- [ ] **BE-DATA.3** · P0 · ⟵ RQ-2.3 · Definir tabla con `PK`/`SK` compuestos tipo string.

- [ ] **BE-DATA.4** · P0 · ⟵ RQ-2.4 · **GSI `LeaderboardIndex`**: partition key `recordType` (solo presente en ítems `STATS`), sort key `totalPoints` (**tipo Number**, no string, o el orden lexicográfico rompe con puntajes de más de un dígito). Proyección `INCLUDE`: `displayName`, `casesCompleted`.
  *Aceptación:* `Query` con `ScanIndexForward: false` sobre `recordType = "STATS"` devuelve el ranking ya ordenado descendente.

- [ ] **BE-DATA.5** · P2 · 🔎 Hallazgo: **límite de escala conocido y aceptado.** `LeaderboardIndex` tiene una única clave de partición (`"STATS"`) para todos los usuarios — es el patrón correcto para ordenar globalmente, pero concentra todas las escrituras de `STATS` en una partición física. A la escala del piloto (28 usuarios) es irrelevante; si el programa crece a miles de usuarios activos concurrentes, requeriría sharding (`recordType = "STATS#<hash-shard>"` + fan-out de lectura). No se implementa ahora; se documenta para no sorprender a nadie después.

### Bucket S3 `bedrock-batch-io`
- [ ] **BE-DATA.6** · P0 · ⟵ ADR-3 · Bucket con dos prefijos: `input/` (JSONL de prompts subido por `submitScenarioBatch`) y `output/` (resultados leídos por `ingestScenarioBatch`). Ciclo de vida: expirar objetos a los 30 días.
  *Aceptación:* ninguna narrativa de paciente queda accesible públicamente — bucket privado, sin política de acceso anónimo.

---

## 4. Contrato de API

Fuente de verdad única para frontend y backend. Base path asumido: `/api`. Todas las rutas requieren JWT de Cognito salvo que se indique lo contrario.

### `GET /api/scenarios/next`
Rol: `voluntario` o `instructor`.
Respuesta `200`:
```ts
{
  scenarioId: string;
  narrative: string;
  steps: { stepId: string; label: string }[]; // orden mezclado, SIN correctSequence
}
```
`404` si no hay ningún caso `publicado`.

- [ ] **BE-API.1** · P0 · ⟵ RQ-4.11, RQ-4.12 · La respuesta **nunca** incluye `correctSequence` ni ningún campo del que se derive el orden correcto.
  *Aceptación:* test de contrato que falla si el shape de respuesta gana un campo no listado arriba.

- [ ] **BE-API.2** · P0 · ⟵ RQ-4.11, A2 · Algoritmo de selección: `Query` sobre `GSI1` con `status = 'publicado'` (acotado, la librería es de tamaño modesto en el piloto); si la política es "menos practicado", cruzar contra los `BEST#*` del usuario (`Query PK=USER#<userId>, SK begins_with('BEST#')`) para excluir o des-priorizar los ya resueltos antes de elegir al azar entre el resto.
  *Aceptación:* dos llamadas seguidas del mismo usuario no repiten un caso mientras existan alternativas sin resolver.

### `POST /api/attempts`
Rol: `voluntario`.
Body:
```ts
{ scenarioId: string; submittedOrder: string[] }
```
Respuesta `200`:
```ts
{
  accuracy: number;          // 0–1
  misplacedSteps: string[];  // stepId de los mal ubicados
  isNewBest: boolean;
  totalPoints: number;
  casesCompleted: number;
  explanation: string | null; // null si Bedrock falló (RQ-4.14)
}
```

- [ ] **BE-API.3** · P0 · ⟵ RQ-4.12, RQ-6.1 · El backend resuelve `correctSequence` internamente por `scenarioId` leído de `Scenarios` — **nunca** confía en un `correctSequence` que venga del cliente. El body de request no acepta ese campo.
  *Aceptación:* un request que incluya `correctSequence` manualmente lo ignora; el resultado se calcula siempre contra el valor server-side.

- [ ] **BE-API.4** · P0 · ⟵ RQ-2.2 · Si `scenarioId` no está en `status: publicado`, responder `404` (no `403`, para no confirmar la existencia de borradores a un cliente que adivina IDs).

### `GET /api/leaderboard?limit=50`
Rol: cualquiera autenticado.
Respuesta `200`:
```ts
{
  entries: { userId: string; displayName: string; totalPoints: number; casesCompleted: number }[];
  me: { position: number; totalPoints: number; casesCompleted: number };
}
```
- [ ] **BE-API.5** · P0 · ⟵ RQ-6.2 · `entries` sale de una única `Query` a `LeaderboardIndex`; `me` se resuelve con una segunda lectura puntual de `STATS` del usuario autenticado (no forzar traer todo el ranking para calcular la posición propia si `limit` es bajo).

### `GET /api/review/scenarios?status=borrador`
Rol: `instructor` únicamente.
Respuesta: lista de escenarios con `correctSequence` **resuelta a etiquetas legibles** (join contra `/domain`), para que el instructor no tenga que interpretar `stepId`.

- [ ] **BE-API.6** · P0 · ⟵ RQ-2.8, RQ-5.13 · Verificación de rol en el handler, no solo en el authorizer de API Gateway (defensa en profundidad: leer el grupo del claim `cognito:groups` del JWT y rechazar con `403` si no es `instructor`).

### `PATCH /api/review/scenarios/{scenarioId}`
Rol: `instructor`.
Body:
```ts
{ action: 'publicar' | 'rechazar'; narrative?: string } // narrative solo si action = 'publicar' y se editó
```
- [ ] **BE-API.7** · P0 · ⟵ RQ-4.8, RQ-4.9 · Transición de estado validada como máquina de estados explícita: solo `borrador → publicado` y `borrador → rechazado` son válidas. Cualquier otra combinación (incluida `publicado → publicado`) responde `409`.

- [ ] **BE-API.8** · P0 · ⟵ RQ-4.10 · El body no acepta `correctSequence`. Ninguna ruta de código de este endpoint puede escribir ese campo.

### Endpoints sin exposición HTTP
- [ ] **BE-API.9** · P0 · ⟵ RQ-2.11 · `submitScenarioBatch` e `ingestScenarioBatch` **no** tienen ruta en API Gateway. Se invocan solo desde EventBridge (programado) o manualmente vía AWS CLI/consola para la siembra inicial (RQ-8.2) — documentar el comando exacto de invocación manual como parte del runbook de despliegue, no como endpoint público.

---

## 5. Lógica de dominio

### `validateOrder` (RQ-3.1)
```ts
function validateOrder(
  submitted: string[],
  correct: string[]
): { accuracy: number; misplacedSteps: string[] };
```
- [ ] **BE-DOM.1** · P0 · ⟵ RQ-3.1 · Implementación posición-por-posición pura, sin I/O. `accuracy = coincidencias / correct.length`. `misplacedSteps` son los `stepId` de `submitted` en posiciones que no coinciden con `correct`.
- [ ] **BE-DOM.2** · P0 · ⟵ RQ-3.2 · Suite de tests previa a la implementación con los ocho casos límite ya enumerados en pm_specs RQ-3.2.

### Agregador de puntaje (RQ-6.1) — 🔎 Hallazgo: la concurrencia no está resuelta en pm_specs

pm_specs pide "actualizar `BEST` solo si mejora" y "recalcular `totalPoints`" pero no dice cómo evitar una condición de carrera entre leer el `BEST` anterior y escribir el nuevo. Diseño concreto:

1. **Lectura consistente** de `BEST#<scenarioId>` (`GetItem`, `ConsistentRead: true`) para conocer `accuracy` previo (o su ausencia = caso nuevo).
2. **`UpdateItem` condicional sobre `BEST#<scenarioId>`**: `ConditionExpression: attribute_not_exists(PK) OR accuracy < :nuevo`, `ReturnValues: ALL_OLD`. Si la condición falla (ya existe un intento mejor), se captura la excepción y el flujo termina aquí: el intento igual se registra en el histórico, pero no toca `BEST` ni `STATS`.
3. Con el resultado de (2) se sabe si es **caso nuevo** (no había ítem previo) o **mejora** (había uno peor), y se calcula el delta: `delta = nuevoAccuracy - (viejoAccuracy ?? 0)`.
4. **`TransactWriteItems`** con dos operaciones: `Put` del ítem `ATTEMPT#...` (incondicional, siempre se registra el intento) + `Update` de `STATS` (`ADD totalPoints :delta` y, solo si era caso nuevo, `ADD casesCompleted 1`).

- [ ] **BE-DOM.3** · P0 · ⟵ RQ-6.1 · Implementar exactamente esta secuencia de 4 pasos en `scoring.ts`.
- [ ] **BE-DOM.4** · P1 · ⟵ RQ-6.5 · 🔎 Hallazgo: **ventana de inconsistencia aceptada.** Si el mismo usuario envía dos intentos concurrentes sobre el mismo caso, ambos pueden leer el mismo `BEST` previo antes de que el otro escriba, produciendo un `totalPoints` con deriva mínima. Es un caso de borde de baja probabilidad (un usuario no suele enviar dos intentos simultáneos del mismo caso desde dos pestañas). Mitigación: la herramienta de recálculo de RQ-6.7 sirve como red de seguridad periódica, no se justifica un lock optimista adicional para el piloto.
- [ ] **BE-DOM.5** · P0 · ⟵ RQ-6.4 · Tests del agregador cubriendo los 5 casos de RQ-6.4 más: intento sobre caso nuevo actualiza `casesCompleted`; intento que empata el `BEST` anterior no debe sumarse dos veces a `totalPoints`.

---

## 6. Integración con Bedrock

### Generación nocturna (`submitScenarioBatch` → `ingestScenarioBatch`)

- [ ] **BE-IA.1** · P0 · ⟵ RQ-4.1 · Prompt de generación separa **material instructivo estable** (system prompt: reglas de estilo, idioma, prohibición de datos reales, instrucción explícita de "no inventes ni cambies el orden de los pasos") de la **plantilla variable** (tipo de caso, dificultad) — el bloque estable va primero y es candidato a *prompt caching* (RQ-4.5).
- [ ] **BE-IA.2** · P0 · ⟵ RQ-4.2 · `submitScenarioBatch` es de solo lectura sobre `Scenarios`: jamás emite un `DeleteItem` ni sobreescribe un ítem existente; solo agrega.
- [ ] **BE-IA.3** · P0 · ⟵ ADR-3 · Registrar cada job enviado (id de job de Bedrock, lista de `templateId` incluidos, timestamp) en un ítem de control — puede vivir en la misma tabla `Scenarios` con `PK = BATCHJOB#<jobId>` o en una tabla auxiliar pequeña; decisión de implementación, no de producto.
- [ ] **BE-IA.4** · P1 · ⟵ RQ-4.6 · `ingestScenarioBatch` procesa el S3 de salida línea por línea; una línea con error de parseo o de contenido no aborta el resto del archivo (se loguea y se continúa).
- [ ] **BE-IA.5** · P0 · ⟵ RQ-T.1 · Test que, sobre una salida de Bedrock simulada, verifica que el `correctSequence` escrito en `Scenarios` es idéntico al de la plantilla de origen — nunca el que "sugeriría" el texto generado.

### Feedback (`submitAttempt` → Bedrock Haiku, síncrono)

- [ ] **BE-IA.6** · P0 · ⟵ RQ-4.13 · Llamada síncrona a `InvokeModel` (no batch) dentro del handler de `submitAttempt`, con **timeout corto** (recomendado 5s) y el prompt conteniendo: secuencia correcta, orden enviado, y `misplacedSteps` ya calculados por `validateOrder`. El prompt instruye explícitamente "explica, no reevalúes ni contradigas estos datos".
- [ ] **BE-IA.7** · P0 · ⟵ RQ-4.14 · Si la llamada falla o excede el timeout, `submitAttempt` responde igual con `explanation: null` — nunca bloquea ni retrasa la respuesta del cálculo de puntaje al usuario.
- [ ] **BE-IA.8** · P0 · ⟵ RQ-7.2 · Test de integración: sobre un conjunto fijo de `misplacedSteps` conocidos, la explicación generada siempre los menciona y nunca afirma que un paso mal ubicado está correcto.
- [ ] **BE-IA.9** · P1 · ⟵ RQ-4.5 · Prompt caching activo también en feedback: el bloque de instrucciones ("cómo explicar", tono, idioma) es estable entre llamadas.

---

## 7. Seguridad

- [ ] **BE-SEC.1** · P0 · ⟵ RQ-2.5 · Cognito User Pool: verificación de email obligatoria antes de habilitar login, política de contraseña mínima razonable (8+ caracteres, no reglas excesivas para un grupo de voluntarios).
- [ ] **BE-SEC.2** · P0 · ⟵ RQ-2.6 · Grupo `instructor` con asignación manual (consola o CLI) — nunca autoasignable desde el flujo de registro.
- [ ] **BE-SEC.3** · P0 · ⟵ RQ-2.7 · JWT authorizer de HTTP API validando `iss` y `aud` contra el User Pool y App Client correctos.
- [ ] **BE-SEC.4** · P0 · ⟵ RQ-2.13 · Tabla de permisos IAM por Lambda:

| Lambda | Dynamo `Scenarios` | Dynamo `Attempts` | Bedrock | S3 batch |
| :--- | :--- | :--- | :--- | :--- |
| `getPublishedScenario` | Read (`GSI1`) | — | — | — |
| `submitAttempt` | Read (GetItem) | Read/Write | Invoke (Haiku) | — |
| `getLeaderboard` | — | Read (`LeaderboardIndex`) | — | — |
| `reviewScenarios` | Read/Write | — | — | — |
| `submitScenarioBatch` | Write | — | `CreateModelInvocationJob` | Write (`input/`) |
| `ingestScenarioBatch` | Write | — | `GetModelInvocationJob` | Read (`output/`) |

  *Aceptación:* ninguna política usa `dynamodb:*` ni `Resource: '*'`; cada Lambda solo puede tocar lo de su fila.

- [ ] **BE-SEC.5** · P1 · ⟵ RQ-7.7 · Throttling en API Gateway (usage plan o límite por ruta) sobre `POST /api/attempts`, más agresivo que el resto por ser el que dispara costo de Bedrock.
- [ ] **BE-SEC.6** · P1 · ⟵ RQ-7.8 · `reviewedBy`/`reviewedAt` se completan con el `sub` del JWT del instructor autenticado, nunca con un valor que envíe el cliente.

---

## 8. Observabilidad y costos

- [ ] **BE-OBS.1** · P1 · ⟵ RQ-T.7 · Logging estructurado (JSON) en todas las Lambdas; usar Embedded Metric Format (EMF vía `@aws-lambda-powertools/metrics`) para emitir tokens de entrada/salida y coste estimado por invocación de Bedrock, con dimensión `flow: generacion | feedback`.
- [ ] **BE-OBS.2** · P1 · ⟵ RQ-T.8 · Alarma de CloudWatch Billing/Cost Anomaly Detection con el umbral acordado en A6 de pm_specs.
- [ ] **BE-OBS.3** · P1 · ⟵ RQ-2.15 · DLQ (SQS) en `submitScenarioBatch` e `ingestScenarioBatch`, con alarma sobre mensajes en la cola.

---

## 9. Testing

- [ ] **BE-TEST.1** · P0 · ⟵ RQ-T.6 · `validateOrder` y `scoring.ts` con cobertura de rama completa antes de integrarlos a los handlers.
- [ ] **BE-TEST.2** · P0 · ⟵ RQ-7.3 · Tests de integración de los 6 endpoints/Lambdas contra DynamoDB Local, incluyendo matriz de autorización (sin token / rol incorrecto / rol correcto) por cada uno.
- [ ] **BE-TEST.3** · P0 · ⟵ RQ-7.1 · Test específico: un escenario `borrador` no aparece en `getPublishedScenario` ni siquiera solicitado por `scenarioId` directo vía `submitAttempt`.
- [ ] **BE-TEST.4** · P1 · **Mocks de Bedrock** con `aws-sdk-client-mock` en unitarios; un test de humo real contra Bedrock (con presupuesto acotado) en CI solo en la rama principal, no en cada PR.
- [ ] **BE-TEST.5** · P1 · ⟵ RQ-2.14 · Tests de infraestructura con `Template.fromStack` verificando que existen las tablas, GSIs, el authorizer JWT y las 6 Lambdas con las políticas IAM esperadas.

---

## 10. Checklist de trazabilidad

Antes de dar por cerrado este documento, confirmar:

1. Toda tarea `BE-*` referencia al menos un `RQ-*` de pm_specs, salvo las marcadas 🔎 Hallazgo (que documentan gaps del propio pm_specs).
2. Los 6 Lambdas de este documento (5 de RQ-2.10 + `ingestScenarioBatch`) tienen fila en la tabla de IAM de BE-SEC.4.
3. Ningún endpoint del contrato (sección 4) expone `correctSequence` fuera del panel de revisión.
4. El hallazgo de ADR-3 (batch inference asíncrono) queda comunicado al usuario como cambio de alcance técnico, no solo enterrado en este archivo.
