import styles from './FeedbackPanel.module.css';
import type { SubmitAttemptResponse } from '@/lib/types';

interface FeedbackPanelProps {
  warning?: string | null;
  result?: SubmitAttemptResponse | null;
  totalSteps: number;
}

// Portado de mockup.html:584-597 (RQ-5.5, RQ-5.6).
export function FeedbackPanel({ warning, result, totalSteps }: FeedbackPanelProps) {
  if (warning) {
    return (
      <div className={`${styles.feedback} ${styles.warn}`} role="alert">
        {warning}
      </div>
    );
  }

  if (!result) return null;

  const percent = Math.round(result.accuracy * 100);
  const matches = Math.round(result.accuracy * totalSteps);

  return (
    <div className={`${styles.feedback} ${styles.ok}`} role="status">
      <p>
        Coincidencia con la secuencia validada: <span className={styles.score}>{percent}%</span>{' '}
        ({matches} de {totalSteps} pasos en su posición correcta). Los pasos en azul están
        correctamente ubicados; los que quedan en rojo conviene repasarlos.
      </p>
      {result.explanation && <p className={styles.explanation}>{result.explanation}</p>}
    </div>
  );
}
