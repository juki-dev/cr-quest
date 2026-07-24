import { cookies } from 'next/headers';
import type { IdTokenClaims, SessionUser } from './types';

/**
 * Manejo de la cookie de sesión (ADR-3). Los tokens de Cognito viven en cookies
 * httpOnly y nunca llegan al JavaScript del navegador. Importa `next/headers`,
 * así que es implícitamente server-only.
 */

/** id token de Cognito — se envía como Bearer hacia el API (httpOnly). */
export const SESSION_COOKIE = 'cr_session';
/** refresh token — para la renovación silenciosa (httpOnly). */
export const REFRESH_COOKIE = 'cr_refresh';
/** state anti-CSRF del flujo OAuth (httpOnly, efímero). */
export const STATE_COOKIE = 'cr_oauth_state';
/** code_verifier de PKCE (httpOnly, efímero). */
export const VERIFIER_COOKIE = 'cr_oauth_verifier';

/** 30 días — horizonte del refresh token por defecto en Cognito. */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

/**
 * Opciones base de las cookies de sesión. `secure` solo en producción para que
 * la vista previa local sobre http://localhost siga funcionando.
 */
export function baseCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  };
}

/** Decodifica el payload del id token SIN verificar la firma. */
export function decodeIdToken(idToken: string): IdTokenClaims | null {
  const parts = idToken.split('.');
  if (parts.length < 2) return null;
  try {
    const payload = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(payload) as IdTokenClaims;
  } catch {
    return null;
  }
}

export function claimsToUser(claims: IdTokenClaims): SessionUser {
  const groups = claims['cognito:groups'] ?? [];
  return {
    userId: claims.sub,
    name: claims.name ?? claims.email ?? 'Voluntario',
    email: claims.email ?? '',
    groups,
    isInstructor: groups.includes('instructor'),
  };
}

/** ¿El id token ya venció (con un margen de holgura)? */
export function isExpired(idToken: string, skewSeconds = 30): boolean {
  const claims = decodeIdToken(idToken);
  if (!claims?.exp) return true;
  return claims.exp * 1000 <= Date.now() + skewSeconds * 1000;
}

/**
 * Lee la sesión desde la cookie httpOnly y la decodifica. Devuelve `null` si no
 * hay cookie o el token es ilegible. NO verifica la firma (los tokens vienen
 * directo del endpoint de Cognito por TLS; la firma la valida el authorizer del
 * API). Solo lo puede llamar código server-side (RSC / Route Handler).
 */
export async function readSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const idToken = store.get(SESSION_COOKIE)?.value;
  if (!idToken) return null;
  const claims = decodeIdToken(idToken);
  return claims ? claimsToUser(claims) : null;
}
