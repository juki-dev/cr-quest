import { type NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens } from '@/lib/auth/cognito';
import {
  REFRESH_COOKIE,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  STATE_COOKIE,
  VERIFIER_COOKIE,
  baseCookieOptions,
  decodeIdToken,
} from '@/lib/auth/session';

/**
 * Callback OAuth (ADR-3). Recibe `code`+`state` de Cognito, valida el state
 * contra la cookie, intercambia el code por tokens server-side (con el PKCE
 * verifier) y guarda el id/refresh token en cookies httpOnly. El navegador
 * nunca ve un token.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const oauthError = searchParams.get('error');

  const cookieState = request.cookies.get(STATE_COOKIE)?.value;
  const verifier = request.cookies.get(VERIFIER_COOKIE)?.value;

  const failTo = (reason: string) => {
    const res = NextResponse.redirect(new URL(`/login?error=${reason}`, request.url));
    res.cookies.delete(STATE_COOKIE);
    res.cookies.delete(VERIFIER_COOKIE);
    return res;
  };

  if (oauthError) return failTo('google');
  if (!code || !state || !cookieState || state !== cookieState || !verifier) {
    return failTo('estado');
  }

  let tokens;
  try {
    tokens = await exchangeCodeForTokens({ code, codeVerifier: verifier });
  } catch {
    return failTo('intercambio');
  }

  if (!decodeIdToken(tokens.id_token)) return failTo('token');

  const response = NextResponse.redirect(new URL('/practica', request.url));
  response.cookies.delete(STATE_COOKIE);
  response.cookies.delete(VERIFIER_COOKIE);

  const persistent = { ...baseCookieOptions(), maxAge: SESSION_MAX_AGE };
  response.cookies.set(SESSION_COOKIE, tokens.id_token, persistent);
  if (tokens.refresh_token) {
    response.cookies.set(REFRESH_COOKIE, tokens.refresh_token, persistent);
  }
  return response;
}
