'use client';

import { useSession } from '@/components/auth/SessionProvider';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import styles from './Sidebar.module.css';

// Iniciales para el avatar a partir del nombre para mostrar.
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'TÚ';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

// Portado de mockup.html:386-404 (RQ-5.9).
export function ProfileCard() {
  const { data, isLoading } = useLeaderboard();
  const { name } = useSession();

  return (
    <div className="card">
      <div className={styles.profileTop}>
        <div className={styles.avatar}>{initials(name)}</div>
        <div>
          <div className={styles.profileName}>{name}</div>
          <div className={styles.profileSub}>
            {isLoading || !data ? 'Cargando…' : `${data.me.position}.º lugar en el ranking general`}
          </div>
        </div>
      </div>
      <div className={styles.profileStats}>
        <div className={styles.stat}>
          <div className={styles.statValue}>{data ? data.me.totalPoints.toLocaleString('es-CO') : '—'}</div>
          <div className={styles.statLabel}>Puntos</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{data ? data.me.casesCompleted : '—'}</div>
          <div className={styles.statLabel}>Casos</div>
        </div>
      </div>
    </div>
  );
}
