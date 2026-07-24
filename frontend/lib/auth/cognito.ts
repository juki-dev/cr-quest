import { oauthConfig } from './config';
import type { TokenSet } from './types';

/**
 * Cliente server-side de los endpoints OAuth de Cognito (Hosted UI). Todo el
 * intercambio de `code`/tokens ocurre aquí, nunca en el navegador (ADR-3).
 */

/** URL de /oauth2/authorize. Va directo a Google (identity_provider=Google). */
export function buildAuthorizeUrl(params: { state: string; codeChallenge: string }): string {
  const url = new URL(`${oauthConfig.domain}/oauth2/authorize`);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', oauthConfig.clientId);
  url.searchParams.set('redirect_uri', oauthConfig.redirectUri);
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', params.state);
  url.searchParams.set('code_challenge', params.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('identity_provider', 'Google');
  return url.toString();
}

/** Cierra sesión en Cognito y vuelve a /login. */
export function buildLogoutUrl(): string {
  const url = new URL(`${oauthConfig.domain}/logout`);
  url.searchParams.set('client_id', oauthConfig.clientId);
  url.searchParams.set('logout_uri', `${oauthConfig.appBaseUrl}/login`);
  return url.toString();
}

export async function exchangeCodeForTokens(params: {
  code: string;
  codeVerifier: string;
}): Promise<TokenSet> {
  return tokenRequest(
    new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: oauthConfig.clientId,
      code: params.code,
      redirect_uri: oauthConfig.redirectUri,
      code_verifier: params.codeVerifier,
    }),
  );
}

export async function refreshTokens(refreshToken: string): Promise<TokenSet> {
  return tokenRequest(
    new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: oauthConfig.clientId,
      refresh_token: refreshToken,
    }),
  );
}

async function tokenRequest(body: URLSearchParams): Promise<TokenSet> {
  const response = await fetch(`${oauthConfig.domain}/oauth2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`Cognito /oauth2/token respondió ${response.status}: ${await response.text()}`);
  }
  return (await response.json()) as TokenSet;
}
