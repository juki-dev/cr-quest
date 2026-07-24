# Infra — CDK (CrQuest)

Cuatro stacks: `CrQuest-Data-<stage>`, `CrQuest-Auth-<stage>`,
`CrQuest-Api-<stage>`, `CrQuest-Web-<stage>`. Todo se despliega por **GitHub
Actions** (`.github/workflows/deploy.yml`, OIDC). **No corras `cdk deploy`
manualmente** — sí podés `cdk synth` para verificar localmente.

## Despliegue del frontend (Amplify, ADR-7)

El `WebStack` define una app de **Amplify Hosting** en modo `WEB_COMPUTE`
(Next.js SSR). Amplify se conecta al repo y **buildea el frontend en cada push
a `main`** — es un pipeline aparte del de GitHub Actions (que despliega la infra,
incluida la *definición* de la app de Amplify).

### Prerrequisitos (una sola vez, antes del primer deploy que incluya Web/Auth)

Crear estos secretos/parámetros en la cuenta AWS (`us-east-1`), porque el deploy
falla al resolverlos si no existen:

| Recurso | Qué contiene | Para qué |
| :--- | :--- | :--- |
| Secrets Manager `cr-quest/github-token` | PAT fine-grained de GitHub con acceso al repo (SecretString plano) | Amplify clona el repo y buildea |
| SSM String `/cr-quest/dev/google/client-id` | Client ID de la OAuth app de Google | IdP de Google en Cognito |
| Secrets Manager `cr-quest/dev/google-oauth` | JSON `{"clientSecret":"..."}` | IdP de Google en Cognito |

Además, en **Google Cloud Console** → crear una OAuth app (Web) y agregar como
*Authorized redirect URI* el `.../oauth2/idpresponse` del dominio Hosted UI
(sale del output `HostedUiDomainOutput` del `AuthStack`).

### Despliegue en dos fases (por la URL de Amplify)

`APP_BASE_URL` / `OAUTH_REDIRECT_URI` dependen del dominio que Amplify asigna,
que no se conoce hasta crear la app. Por eso:

1. **Fase 1 — crear todo.** Push a `main` (o `workflow_dispatch` sin
   `frontendUrl`). Se crean los 4 stacks; el `AuthStack` queda con callbacks solo
   para `localhost`. Copiá el output `FrontendUrlOutput` del `CrQuest-Web-<stage>`
   (algo como `https://main.d1a2b3c.amplifyapp.com`).
2. **Configurar Google + Cognito con esa URL.** Agregá
   `https://main.<appId>.amplifyapp.com/api/auth/callback` a la OAuth app de
   Google (Authorized redirect URIs del *idpresponse* ya lo tenías; este es el
   redirect final del App Client).
3. **Fase 2 — registrar el callback en Cognito.** Volvé a correr el workflow por
   `workflow_dispatch` pasando `frontendUrl=https://main.<appId>.amplifyapp.com`.
   Eso agrega el callback/logout de producción a los `callbackUrls` del App
   Client. (El `appId` es estable entre deploys, así que esto se hace una vez.)

Verificación local del synth (no despliega):

```bash
cd infra
CDK_DEFAULT_ACCOUNT=<acct> CDK_DEFAULT_REGION=us-east-1 \
  npx cdk synth CrQuest-Web-dev -c stage=dev \
  -c frontendUrl=https://main.d1a2b3c.amplifyapp.com
```

### Variables de entorno del frontend

El `WebStack` las inyecta en Amplify desde los outputs de los otros stacks
(`BACKEND_API_URL`, `COGNITO_DOMAIN`, `COGNITO_CLIENT_ID`, `APP_BASE_URL`,
`OAUTH_REDIRECT_URI`). Para la **vista previa local** las mismas variables van en
`frontend/.env.local` — ver `frontend/env.local.example`.
