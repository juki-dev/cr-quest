import { cookies } from 'next/headers';
import { refreshTokens } from '@/lib/auth/cognito';
import {
  REFRESH_COOKIE,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  baseCookieOptions,
  isExpired,
} from '@/lib/auth/session';

/**
 * BFF (ADR-3): los Route Handlers proxean al backend real adjuntando el token
 * server-side, así nunca llega al JS del navegador. El token sale de la cookie
 * de sesión (id token de Cognito). Renovación silenciosa ante 401 (FE-AUTH.4).
 */

/** Lee el id token de la cookie; si venció, intenta refrescarlo de una vez. */
async function currentIdToken(): Promise<string | null> {
  const store = await cookies();
  const idToken = store.get(SESSION_COOKIE)?.value ?? null;
  if (idToken && isExpired(idToken)) {
    return refreshSession();
  }
  return idToken;
}

/** Canjea el refresh token por un id token nuevo y actualiza la cookie. */
async function refreshSession(): Promise<string | null> {
  const store = await cookies();
  const refreshToken = store.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return null;
  try {
    const tokens = await refreshTokens(refreshToken);
    store.set(SESSION_COOKIE, tokens.id_token, { ...baseCookieOptions(), maxAge: SESSION_MAX_AGE });
    return tokens.id_token;
  } catch {
    return null;
  }
}

async function callBackend(
  backendUrl: string,
  path: string,
  init: RequestInit | undefined,
  token: string,
): Promise<Response> {
  return fetch(`${backendUrl}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    cache: 'no-store',
  });
}

export async function proxyToBackend(path: string, init?: RequestInit): Promise<Response> {
  const backendUrl = process.env.BACKEND_API_URL;
  if (!backendUrl) {
    return Response.json(
      { message: 'Falta BACKEND_API_URL en frontend/.env.local.' },
      { status: 500 },
    );
  }

  let idToken = await currentIdToken();
  const usingSession = idToken !== null;

  // Fallback de vista previa: token fijo del usuario de prueba mientras se
  // termina de configurar el login con Google. Quitar cuando el flujo real
  // esté en pie (fe_specs § 7). Con este token no intentamos refresh.
  if (!idToken && process.env.BACKEND_API_TOKEN) {
    idToken = process.env.BACKEND_API_TOKEN;
  }

  if (!idToken) {
    return Response.json({ message: 'No autenticado.' }, { status: 401 });
  }

  let response = await callBackend(backendUrl, path, init, idToken);

  // FE-AUTH.4 — un 401 del backend con sesión real: refrescar y reintentar una vez.
  if (response.status === 401 && usingSession) {
    const refreshed = await refreshSession();
    if (refreshed) {
      response = await callBackend(backendUrl, path, init, refreshed);
    }
  }

  const body = await response.text();
  return new Response(body, {
    status: response.status,
    headers: { 'content-type': 'application/json' },
  });
}
