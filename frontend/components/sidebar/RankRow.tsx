import styles from './Sidebar.module.css';

interface RankRowProps {
  position: number;
  displayName: string;
  casesCompleted: number;
  totalPoints: number;
  isMe: boolean;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Portado de mockup.html:278-331 (RQ-5.10, RQ-5.11 — misma fila en sidebar y en /ranking).
export function RankRow({ position, displayName, casesCompleted, totalPoints, isMe }: RankRowProps) {
  const posClasses = [styles.rankPos, position <= 3 ? styles.top : '', position === 1 ? styles.first : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={`${styles.rankRow} ${isMe ? styles.me : ''}`}>
      <div className={posClasses}>{position}</div>
      <div className={styles.rankAvatar}>{initialsOf(displayName)}</div>
      <div className={styles.rankInfo}>
        <div className={styles.rankName}>{displayName}</div>
        <div className={styles.rankMeta}>{casesCompleted} casos</div>
      </div>
      <div className={styles.rankPoints}>{totalPoints.toLocaleString('es-CO')}</div>
    </div>
  );
}
