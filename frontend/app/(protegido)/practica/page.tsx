import { LeaderboardWidget } from '@/components/sidebar/LeaderboardWidget';
import { ProfileCard } from '@/components/sidebar/ProfileCard';
import { PracticeBoard } from '@/components/practica/PracticeBoard';
import sidebarStyles from '@/components/sidebar/Sidebar.module.css';
import styles from './page.module.css';

export default function PracticaPage() {
  return (
    <div className={styles.layout}>
      <main>
        <PracticeBoard />
      </main>
      <aside className={sidebarStyles.sidebar}>
        <ProfileCard />
        <LeaderboardWidget />
      </aside>
    </div>
  );
}
