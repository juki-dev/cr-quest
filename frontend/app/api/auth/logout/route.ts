import { NextResponse } from 'next/server';
import { buildLogoutUrl } from '@/lib/auth/cognito';
import { REFRESH_COOKIE, SESSION_COOKIE } from '@/lib/auth/session';

/**
 * Logout (FE-AUTH.6). El cliente no puede borrar las cookies httpOnly por
 * diseño, así que lo hace este handler: limpia la sesión local y redirige al
 * /logout de Cognito para cerrar también la sesión del pool. 303 fuerza que el
 * POST del formulario se convierta en un GET al redirigir.
 */
export async function POST() {
  const response = NextResponse.redirect(buildLogoutUrl(), 303);
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.delete(REFRESH_COOKIE);
  return response;
}
