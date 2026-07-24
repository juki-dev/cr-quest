'use client';

import { createContext, useContext } from 'react';
import type { SessionUser } from '@/lib/auth/types';

/**
 * Expone el usuario autenticado a los componentes cliente. El valor lo provee
 * el layout protegido (server component) que sí puede leer la cookie httpOnly,
 * así el cliente nunca toca los tokens (ADR-3) y no hay desajuste de hidratación.
 */
const SessionContext = createContext<SessionUser | null>(null);

export function SessionProvider({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionUser {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession debe usarse dentro de <SessionProvider>');
  }
  return ctx;
}
