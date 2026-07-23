'use client';

import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import styles from './PracticeBoard.module.css';
import { Slot } from './Slot';

interface SequenceSlotsProps {
  sequenceIds: string[];
  labels: Record<string, string>;
  misplacedSteps: string[] | null; // no-null solo tras un submit; nunca se recibe correctSequence (RQ-4.12)
  onRemove: (index: number) => void;
}

// Portado de mockup.html:369-372 (RQ-5.1, RQ-5.2).
export function SequenceSlots({ sequenceIds, labels, misplacedSteps, onRemove }: SequenceSlotsProps) {
  return (
    <div>
      <p className={styles.seqTitle}>Tu orden de valoración</p>
      <div className={styles.sequence}>
        <SortableContext items={sequenceIds} strategy={verticalListSortingStrategy}>
          {sequenceIds.map((id, index) => {
            const isPlaceholder = id.startsWith('__empty-');
            const submitted = misplacedSteps !== null;
            const isMisplaced = (misplacedSteps ?? []).includes(id);
            return (
              <Slot
                key={id}
                id={id}
                index={index}
                label={isPlaceholder ? null : (labels[id] ?? id)}
                markedCorrect={submitted && !isPlaceholder && !isMisplaced}
                markedIncorrect={submitted && !isPlaceholder && isMisplaced}
                onRemove={() => onRemove(index)}
              />
            );
          })}
        </SortableContext>
      </div>
    </div>
  );
}
