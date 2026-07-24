import { redirect } from 'next/navigation';
import { readSession } from '@/lib/auth/session';
import styles from './login.module.css';

// Mensajes de error del flujo OAuth (?error= en el callback fallido).
const ERRORES: Record<string, string> = {
  google: 'No se pudo completar el inicio con Google. Intenta de nuevo.',
  estado: 'La sesión de inicio expiró o no es válida. Vuelve a intentarlo.',
  intercambio: 'No pudimos verificar tu identidad con el servidor. Intenta de nuevo.',
  token: 'La respuesta de autenticación no fue válida. Intenta de nuevo.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Si ya hay sesión, no tiene sentido mostrar el login.
  if (await readSession()) redirect('/practica');

  const { error } = await searchParams;
  const mensaje = error ? (ERRORES[error] ?? 'Ocurrió un error al iniciar sesión.') : null;

  return (
    <main className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <span className="brand-mark" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 12h4l2 7 4-14 2 7h8" />
            </svg>
          </span>
          Entrenamiento APH
        </div>

        <h1 className={styles.title}>Practica la valoración del paciente</h1>
        <p className={styles.subtitle}>
          Ordena los pasos de la evaluación primaria y la atención prehospitalaria. Ingresa con tu
          cuenta de Google para guardar tu progreso y aparecer en el ranking.
        </p>

        {mensaje && (
          <p className={styles.error} role="alert">
            {mensaje}
          </p>
        )}

        <a className={styles.google} href="/api/auth/login">
          <GoogleLogo />
          Continuar con Google
        </a>

        <p className={styles.legal}>
          Herramienta de práctica y memorización. No sustituye la formación certificada ni una
          evaluación clínica real.
        </p>
      </div>
    </main>
  );
}

// Logo oficial "G" de Google (multicolor), inline para no depender de red externa.
function GoogleLogo() {
  return (
    <svg className={styles.googleIcon} viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}
