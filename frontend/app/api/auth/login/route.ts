import { NextResponse } from 'next/server';
import { buildAuthorizeUrl } from '@/lib/auth/cognito';
import { codeChallengeS256, randomUrlSafe } from '@/lib/auth/pkce';
import { STATE_COOKIE, VERIFIER_COOKIE, baseCookieOptions } from '@/lib/auth/session';

/**
 * Inicia el login con Google (FE-AUTH.1). Genera state (anti-CSRF) y el
 * code_verifier de PKCE, los guarda en cookies httpOnly efímeras y redirige a
 * /oauth2/authorize de Cognito. Es una navegación GET de nivel superior: las
 * cookies del redirect quedan guardadas y viajan de vuelta al callback.
 */
export async function GET() {
  const state = randomUrlSafe(16);
  const verifier = randomUrlSafe(32);
  const authorizeUrl = buildAuthorizeUrl({
    state,
    codeChallenge: codeChallengeS256(verifier),
  });

  const response = NextResponse.redirect(authorizeUrl);
  const ephemeral = { ...baseCookieOptions(), maxAge: 600 }; // 10 min para completar el login
  response.cookies.set(STATE_COOKIE, state, ephemeral);
  response.cookies.set(VERIFIER_COOKIE, verifier, ephemeral);
  return response;
}
