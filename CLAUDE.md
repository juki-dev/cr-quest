# Contexto del proyecto — Plataforma de entrenamiento Cruz Roja

## Qué es

Plataforma serverless para que voluntarios practiquen el orden de evaluación
de pacientes (evaluación primaria → APH) ordenando pasos (drag & drop).
Es una herramienta de práctica y memorización, no una evaluación formal.
La librería de casos crece cada noche vía un batch acumulativo; un leaderboard
general por usuario premia resolver más casos y resolverlos bien.

Specs de referencia en `/specs`:
- `Guia_Implementacion_Plataforma_PrimerosAuxilios.md` — guía original por fases.
- `initial_implementation/pm_specs.md` — backlog de producto derivado (IDs `RQ-*`).
- `initial_implementation/be_specs.md` — diseño técnico de backend (IDs `BE-*`, ADRs).
- `initial_implementation/fe_specs.md` — diseño técnico de frontend (IDs `FE-*`, ADRs).

## Regla de oro (INNEGOCIABLE)

- Nunca inventes ni modifiques protocolos médicos ni secuencias correctas.
- La fuente de verdad son los archivos validados en `/domain`.
- La IA solo genera narrativa y explica; nunca decide qué está bien.
- Ningún caso generado llega a un voluntario sin pasar por revisión
  (status: borrador -> revisado/publicado -> solo publicado es visible).
- Cualquier cambio en `/domain` requiere revisión de un instructor certificado.
  Hoy **todo** el contenido de `/domain` (incluidas las 6 plantillas y los 14
  pasos) tiene `validatedBy: 'instructor.pendiente@cruzroja.example'` — es un
  placeholder, no una validación real. No lo trates como fuente de verdad
  clínica hasta que ese campo tenga la firma de un instructor de verdad.

## Estado actual (referencia rápida, puede desactualizarse — verificar con `git log` / AWS antes de asumir)

- **Backend + infra: desplegados y verificados end-to-end** en la cuenta AWS
  `992382630799` (perfil local `ops`), región `us-east-1`, stage `dev`.
  API real: `https://h0swa6z9f2.execute-api.us-east-1.amazonaws.com`.
- **Despliegue vía GitHub Actions únicamente** (`.github/workflows/deploy.yml`,
  OIDC sin credenciales de larga duración) — repo `github.com/juki-dev/cr-quest`.
  No corras `cdk deploy` manualmente desde una sesión de agente.
- **Frontend: no desplegado todavía, pero el hosting ya está como código.**
  Hay un preview local (`frontend/.env.local`, gitignored) que conecta el dev
  server al backend real vía un BFF mínimo (`app/api/*` → `lib/backendProxy.ts`).
  El `WebStack` (`infra/lib/web-stack.ts`) define el hosting en **AWS Amplify**
  (`WEB_COMPUTE`/Next.js SSR, ADR-7): 4.º stack `CrQuest-Web-<stage>`. Amplify
  buildea el frontend en cada push a `main` (pipeline aparte del de Actions).
  Prerrequisitos y despliegue en dos fases documentados en `infra/README.md`
  (secreto `cr-quest/github-token`, y la URL de Amplify que en la fase 2 se pasa
  como `-c frontendUrl=...` para registrar el callback en Cognito).
- **Login con Google (federado vía Cognito) implementado como código**, no
  desplegado aún (fe_specs ADR-2 revisado). Pantalla `/login` + Route Handlers
  OAuth+PKCE (`app/api/auth/{login,callback,logout}`, `lib/auth/*`); las rutas
  autenticadas viven bajo `app/(protegido)/` con guardia server-side. El BFF ya
  lee el id token de la cookie httpOnly, con fallback al `BACKEND_API_TOKEN` de
  prueba mientras no haya login real. **Para que funcione end-to-end falta:**
  (1) crear la OAuth app en Google Cloud y guardar sus credenciales en SSM
  `/cr-quest/<stage>/google/client-id` y Secrets Manager
  `cr-quest/<stage>/google-oauth` (clave `clientSecret`); (2) desplegar el
  `AuthStack` (por GitHub Actions) para crear el IdP de Google + dominio Hosted
  UI + OAuth flows; (3) completar `frontend/.env.local` con los outputs del
  stack (ver `frontend/env.local.example`).
- **Cron de generación nocturna: DESACTIVADO a propósito**
  (`NightlyBatchSchedule` en `infra/lib/api-stack.ts`, `state: 'DISABLED'`)
  hasta tener el prompt de generación definitivo. No lo reactives sin que te
  lo pidan explícitamente.
- **Librería de casos:** 6 `ScenarioTemplate` en `domain/src/templates.ts`
  (2 originales + 4 redactadas con ayuda de IA a partir de fuentes de Cruz
  Roja vía NotebookLM/Gemini), 14 `AssessmentStep` en `domain/src/steps.ts`
  (6 de evaluación primaria + 8 de atención específica). De los 12 tipos de
  caso que trajo el borrador de IA, solo 4 tienen secuencia completa; el
  resto quedó pendiente de una segunda pasada. Ver comentarios en
  `templates.ts` — hay un patrón (s1-s6 seguidos del paso específico, sin
  variación) que un instructor debería revisar con atención, en particular
  en `hemorragia_externa`.
- Hay 3 escenarios de prueba sembrados a mano en DynamoDB (`scn-test-001/2/3`,
  `status: publicado`), sin pasar por Bedrock, solo para probar interfaz y
  endpoints. Se pueden borrar cuando haya contenido real.

## Stack (como quedó construido, no solo el propuesto)

| Capa | Elección | Notas |
| :--- | :--- | :--- |
| Infra | AWS CDK (TypeScript), 3 stacks: `CrQuest-Data-<stage>`, `CrQuest-Auth-<stage>`, `CrQuest-Api-<stage>` | `NodejsFunction` + esbuild bundlea el código real de `/backend/src/handlers/entry` |
| Backend | Node.js 20 en Lambda (ARM64) + API Gateway HTTP API | JWT authorizer de Cognito; 6 Lambdas (5 de la guía + `ingestScenarioBatch`, ver ADR-3 en be_specs) |
| Datos | DynamoDB single-table (`Scenarios`, `Attempts`) con GSI | Exactamente como se diseñó en be_specs § 3 |
| IA | Amazon Bedrock, **vía inference profile**, no el modelId base (ver hallazgos) | Generación: `us.anthropic.claude-sonnet-4-6`. Feedback: `us.anthropic.claude-haiku-4-5-20251001-v1:0`. IDs resueltos por SSM (`config.ts`), nunca hardcodeados |
| Frontend | Next.js (App Router) + `@dnd-kit` | Pantalla de práctica funcional contra datos mock por defecto; BFF listo para conectar a backend real |
| CI/CD | GitHub Actions + OIDC | `.github/workflows/deploy.yml`: lint+typecheck+test como gate antes de `cdk deploy --all` |

## Hallazgos técnicos (para no volver a perder horas redescubriendo esto)

1. **Bedrock batch inference exige mínimo 100 registros por job.** Con pocas
   plantillas, `buildBatchRecords` (`backend/src/ia/batchJob.ts`) las repite
   cíclicamente hasta completar el mínimo, con `recordId = templateId#instancia`
   (el modelo genera una narrativa distinta en cada repetición — variedad
   real, no copias). `templateIdFromRecordId` deshace el sufijo al ingerir.
2. **Sonnet 4.6 y Haiku 4.5 en Bedrock solo exponen `inferenceTypesSupported:
   ['INFERENCE_PROFILE']`** (`aws bedrock get-foundation-model`). No aceptan
   invocación ni batch inference por el modelId base — hace falta el ARN del
   inference profile (`arn:...:inference-profile/us.anthropic....`).
3. **Un inference profile cross-region no alcanza como único recurso en la
   policy de IAM.** Bedrock autoriza la invocación real contra el
   foundation-model subyacente al que el profile enruta. Hace falta conceder
   permiso sobre **ambos** ARN (profile + foundation-model) o falla con
   `AccessDenied` recién al invocar, no al desplegar — confirmado vía
   CloudTrail, no por los mensajes de error de la Lambda.
4. **`CreateModelInvocationJob` autoriza sobre el recurso
   `model-invocation-job/*`** (con cuenta), no sobre el ARN de
   foundation-model — son formatos de ARN distintos y hace falta el correcto.
5. **`ssm.StringParameter.fromStringParameterName(...).grantRead()` sintetiza
   un `CfnParameter` de tipo `AWS::SSM::Parameter::Value<String>`**, que
   CloudFormation resuelve consultando SSM *antes* de crear cualquier recurso
   del stack. Si el parámetro se crea como recurso en el mismo deploy, es una
   referencia circular que nunca funciona. Usar un `iam.PolicyStatement` con
   el ARN armado a mano (`arn:aws:ssm:<region>:<account>:parameter/...`) en
   su lugar.
6. **Bedrock puede exigir un formulario de "use case details"** en la consola
   antes de habilitar la invocación de ciertos modelos — tarda hasta ~15 min
   en propagar después de enviarlo.
7. **El claim `sub` de los tokens OIDC de GitHub Actions incluye IDs
   numéricos inmutables** del owner y del repo
   (`repo:owner@<id>/repo@<id>:...`), no solo el nombre. Verificar el valor
   real vía CloudTrail (`AssumeRoleWithWebIdentity` con `errorCode
   AccessDenied`) en vez de asumir el formato de los tutoriales.
8. **`NodejsFunction` con bundling ESM necesita esbuild instalado también en
   la raíz del workspace pnpm**, no solo en `/infra` — CDK a veces invoca
   `pnpm exec esbuild` desde `projectRoot` (la raíz del monorepo).
9. **`generateFeedback` degrada a `explanation: null` sin loguear el error**
   por diseño (BE-IA.7: nunca bloquear la respuesta) — pero eso también deja
   ciego el debugging. Revisar los logs de CloudWatch de `SubmitAttemptFn`
   (ahora sí loguean el error real) antes de asumir que es un timeout.

## Cómo se puntúa (no cambiar sin discutirlo)

- `accuracy` del intento = pasos en posición correcta / total de pasos.
- Por cada caso solo cuenta el MEJOR intento del usuario (`BEST#<scenarioId>`).
- `totalPoints` del usuario = suma de esos mejores `accuracy`, uno por caso distinto.
- El leaderboard es GENERAL (no por caso, no por ciclo) y ordena por `totalPoints`.
- El tiempo NUNCA interviene en el cálculo.

## Convenciones

- TypeScript estricto en los 4 paquetes (`domain`, `backend`, `infra`, `frontend`).
- Funciones puras para lógica de validación y puntuación (`validateOrder`, `computeScoreUpdate`).
- Tests unitarios antes de la implementación en módulos críticos.
- Incrementos pequeños; un cambio verificable por vez.
- Idioma de la UI y del contenido: español.
- Commits con mensaje descriptivo explicando el *porqué*, no solo el qué.

## No hacer

- No introducir datos reales de pacientes.
- No usar búsqueda vectorial; el contenido va inyectado en el prompt.
- No reemplazar ni vaciar la librería de casos en el batch nocturno: solo se agrega.
- No publicar un caso sin que pase por el estado "revisado"/la acción de publicar.
- No incluir tiempo ni velocidad en el puntaje ni en el leaderboard.
- No promover contenido de `/domain` a "validado" sin la firma real de un
  instructor — no cambies `validatedBy` a mano para simular una aprobación.
- No hardcodear IDs de modelo de Bedrock en código — siempre vía SSM (`config.ts`).
- No usar el modelId base de Bedrock para Sonnet/Haiku — siempre el ARN del inference profile.
- No reactivar `NightlyBatchSchedule` sin que te lo pidan explícitamente.
- No correr `cdk deploy` manualmente — todo pasa por GitHub Actions
  (`git push` a `main`, o `workflow_dispatch`).
- No hacer commit de `.env.local` ni de ningún token/credencial.
