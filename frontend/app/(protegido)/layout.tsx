import { redirect } from 'next/navigation';
import { SessionProvider } from '@/components/auth/SessionProvider';
import { Topbar } from '@/components/layout/Topbar';
import { readSession } from '@/lib/auth/session';

/**
 * FE-ROUTE.1 — puerta de todas las pantallas autenticadas. Valida la cookie de
 * sesión server-side (RSC) y redirige a /login antes de renderizar cualquier
 * hijo; nunca depende de ocultar UI en el cliente. Provee el usuario a los
 * componentes cliente vía SessionProvider.
 */
export default async function ProtegidoLayout({ children }: { children: React.ReactNode }) {
  const user = await readSession();
  if (!user) redirect('/login');

  return (
    <SessionProvider user={user}>
      <Topbar userName={user.name} />
      {children}
    </SessionProvider>
  );
}
