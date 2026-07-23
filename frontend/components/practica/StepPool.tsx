'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import styles from './PracticeBoard.module.css';
import { Chip } from './Chip';

interface StepPoolProps {
  stepIds: string[];
  labels: Record<string, string>;
  onQuickPlace: (stepId: string) => void;
}

// Portado de mockup.html:365-368 (RQ-5.1, RQ-5.2).
export function StepPool({ stepIds, labels, onQuickPlace }: StepPoolProps) {
  const { setNodeRef, isOver } = useDroppable({ id: 'pool' });

  return (
    <div>
      <p className={styles.poolTitle}>Pasos disponibles — arrástralos o tócalos para ubicarlos</p>
      <div ref={setNodeRef} className={`${styles.pool} ${isOver ? styles.over : ''}`}>
        <SortableContext items={stepIds} strategy={verticalListSortingStrategy}>
          {stepIds.map((stepId) => (
            <Chip
              key={stepId}
              stepId={stepId}
              label={labels[stepId] ?? stepId}
              onQuickPlace={() => onQuickPlace(stepId)}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
