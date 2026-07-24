import { createHash, randomBytes } from 'node:crypto';

/**
 * PKCE (RFC 7636) para el App Client público. El BFF genera el `code_verifier`,
 * envía su hash (`code_challenge`) a /authorize y presenta el verifier en
 * /token; así el `code` interceptado no sirve sin el verifier que nunca sale
 * del servidor.
 */
export function randomUrlSafe(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function codeChallengeS256(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}
