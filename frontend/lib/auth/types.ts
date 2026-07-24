/**
 * Tipos compartidos de autenticación. Este módulo NO importa `next/headers`
 * ni Node crypto, así puede importarse también desde componentes cliente
 * (solo el tipo `SessionUser`).
 */

/** Usuario autenticado, derivado de los claims del id token de Cognito. */
export interface SessionUser {
  /** `sub` del token — identidad estable del usuario. */
  userId: string;
  name: string;
  email: string;
  groups: string[];
  /** Atajo para gatear UI de instructor (defensa en profundidad, FE-ROUTE.2). */
  isInstructor: boolean;
}

/** Claims relevantes del id token de Cognito. */
export interface IdTokenClaims {
  sub: string;
  name?: string;
  email?: string;
  'cognito:groups'?: string[];
  exp: number;
}

/** Respuesta del endpoint /oauth2/token de Cognito. */
export interface TokenSet {
  id_token: string;
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}
