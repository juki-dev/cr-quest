import { redirect } from 'next/navigation';

// Redirige a la pantalla de práctica; será /login cuando exista autenticación (fe_specs.md § 3).
export default function Home() {
  redirect('/practica');
}
