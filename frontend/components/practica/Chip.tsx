'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import styles from './PracticeBoard.module.css';

interface ChipProps {
  stepId: string;
  label: string;
  onQuickPlace: () => void;
}

// Portado de mockup.html:140-160 (RQ-5.2). El atajo de clic para colocar en el
// siguiente slot vacío (RQ-5.7 / mockup.html:520) queda como convención de puntero;
// el teclado usa el flujo estándar de dnd-kit (Espacio recoge, flechas mueven, Espacio suelta),
// que ya cubre el caso de uso completo sin competir por las mismas teclas.
export function Chip({ stepId, label, onQuickPlace }: ChipProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stepId,
    data: { container: 'pool' },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`${styles.chip} ${isDragging ? styles.dragging : ''}`}
      onClick={onQuickPlace}
      data-testid={`chip-${stepId}`}
      {...attributes}
      {...listeners}
    >
      <span className={styles.dot} aria-hidden="true" />
      {label}
    </div>
  );
}
