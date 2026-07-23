'use client';

import { useLeaderboard } from '@/hooks/useLeaderboard';
import styles from './Sidebar.module.css';

// Portado de mockup.html:386-404 (RQ-5.9).
export function ProfileCard() {
  const { data, isLoading } = useLeaderboard();

  return (
    <div className="card">
      <div className={styles.profileTop}>
        <div className={styles.avatar}>TÚ</div>
        <div>
          <div className={styles.profileName}>Tu progreso</div>
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
