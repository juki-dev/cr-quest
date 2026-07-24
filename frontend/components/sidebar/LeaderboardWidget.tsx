'use client';

import { useSession } from '@/components/auth/SessionProvider';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import { RankRow } from './RankRow';
import styles from './Sidebar.module.css';

const TOP_N = 5;

// Portado de mockup.html:406-479 (RQ-5.10). Muestra el top y, si el usuario
// queda fuera de él, agrega su fila igual — nunca desaparece de su propia vista.
export function LeaderboardWidget() {
  const { data, isLoading } = useLeaderboard();
  const { userId: currentUserId } = useSession();

  if (isLoading || !data) {
    return <div className="card">Cargando ranking…</div>;
  }

  const top = data.entries.slice(0, TOP_N);
  const meInTop = top.some((e) => e.userId === currentUserId);
  const meEntry = data.entries.find((e) => e.userId === currentUserId);

  return (
    <div className="card">
      <p className={styles.rankingTitle}>Ranking general</p>
      <p className={styles.rankingSub}>Puntos = suma del mejor acierto por cada caso resuelto</p>

      {top.map((entry, i) => (
        <RankRow
          key={entry.userId}
          position={i + 1}
          displayName={entry.displayName}
          casesCompleted={entry.casesCompleted}
          totalPoints={entry.totalPoints}
          isMe={entry.userId === currentUserId}
        />
      ))}

      {!meInTop && meEntry && (
        <RankRow
          position={data.me.position}
          displayName={meEntry.displayName}
          casesCompleted={meEntry.casesCompleted}
          totalPoints={meEntry.totalPoints}
          isMe
        />
      )}
    </div>
  );
}
