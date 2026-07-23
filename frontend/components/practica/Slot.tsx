'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { isEmptySlot } from '@/lib/practiceBoard';
import styles from './PracticeBoard.module.css';

interface SlotProps {
  id: string;
  index: number;
  label: string | null;
  markedCorrect?: boolean;
  markedIncorrect?: boolean;
  onRemove: () => void;
}

// Portado de mockup.html:369-372, 529-536 (RQ-5.1, RQ-5.2, RQ-5.6).
export function Slot({ id, index, label, markedCorrect, markedIncorrect, onRemove }: SlotProps) {
  const empty = isEmptySlot(id);
  const { attributes, listeners, setNodeRef, transform, transition, isOver } = useSortable({
    id,
    disabled: empty,
    data: { container: 'sequence' },
  });

  const classes = [
    styles.slot,
    empty ? styles.empty : styles.filled,
    isOver ? styles.over : '',
    markedCorrect ? styles.correct : '',
    markedIncorrect ? styles.incorrect : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={classes}
      onClick={empty ? undefined : onRemove}
      data-testid={`slot-${index}`}
      {...(empty ? {} : attributes)}
      {...(empty ? {} : listeners)}
    >
      <span className={styles.slotNum}>{index + 1}</span>
      {label ?? 'Suelta aquí un paso'}
    </div>
  );
}
