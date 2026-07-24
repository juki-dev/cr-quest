import styles from './Topbar.module.css';

export function Topbar({ userName }: { userName?: string }) {
  return (
    <header className={styles.topbar}>
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
      <div className={styles.brandSub}>Práctica de valoración del paciente</div>

      {userName && (
        <div className={styles.session}>
          <span className={styles.userName}>{userName}</span>
          {/* El logout borra cookies httpOnly: solo el servidor puede hacerlo (ADR-3),
              por eso es un form POST y no un onClick. */}
          <form action="/api/auth/logout" method="post">
            <button type="submit" className={styles.logout}>
              Cerrar sesión
            </button>
          </form>
        </div>
      )}
    </header>
  );
}
