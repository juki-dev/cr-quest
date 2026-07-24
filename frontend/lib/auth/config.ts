/**
 * Configuración del flujo OAuth de Cognito, leída de variables de entorno
 * (frontend/.env.local, ver env.local.example). Solo se usa server-side.
 * Getters perezosos: no revientan al importar en build, solo cuando de verdad
 * se necesita el valor en una request.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name} (ver frontend/env.local.example).`);
  }
  return value;
}

export const oauthConfig = {
  /** Base del dominio Hosted UI, p.ej. https://cr-quest-dev.auth.us-east-1.amazoncognito.com */
  get domain(): string {
    return required('COGNITO_DOMAIN').replace(/\/+$/, '');
  },
  get clientId(): string {
    return required('COGNITO_CLIENT_ID');
  },
  /** URL de callback del BFF; debe estar en los callbackUrls del App Client. */
  get redirectUri(): string {
    return required('OAUTH_REDIRECT_URI');
  },
  /** Origen público del frontend, para armar el logout_uri. */
  get appBaseUrl(): string {
    return required('APP_BASE_URL').replace(/\/+$/, '');
  },
};
