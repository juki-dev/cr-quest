'use client';

import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useMemo, useState } from 'react';
import { useSubmitAttempt } from '@/hooks/useSubmitAttempt';
import {
  createBoard,
  isComplete,
  moveItem,
  placeInNextEmptySlot,
  removeFromSlot,
  type BoardState,
} from '@/lib/practiceBoard';
import type { ScenarioResponse, SubmitAttemptResponse } from '@/lib/types';
import { FeedbackPanel } from './FeedbackPanel';
import styles from './PracticeBoard.module.css';
import { NarrativeCard } from './NarrativeCard';
import { SequenceSlots } from './SequenceSlots';
import { StepPool } from './StepPool';

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

interface PracticeSessionProps {
  scenario: ScenarioResponse;
  onRequestNext: () => void;
}

// Instanciado con key={scenario.scenarioId} desde PracticeBoard: cada caso nuevo
// remonta este componente y arranca con tablero limpio, sin necesitar un efecto
// que sincronice estado derivado de una prop (evita el anti-patrón detectado por
// la regla react-hooks/set-state-in-effect).
export function PracticeSession({ scenario, onRequestNext }: PracticeSessionProps) {
  const submitAttempt = useSubmitAttempt();

  const [board, setBoard] = useState<BoardState>(() => createBoard(scenario.steps));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitAttemptResponse | null>(null);

  const labels = useMemo(
    () => Object.fromEntries(scenario.steps.map((s) => [s.stepId, s.label])),
    [scenario],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const labelOf = (id: string) => labels[id] ?? 'paso';
  const describeTarget = (id: string) => {
    if (id === 'pool') return 'la lista de pasos disponibles';
    if (id.startsWith('__empty-')) return `la posición ${Number(id.split('-')[1]) + 1}`;
    if (board.sequence.includes(id)) return `la posición ${board.sequence.indexOf(id) + 1}`;
    return `junto a "${labelOf(id)}"`;
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Se recogió el paso "${labelOf(String(active.id))}".`,
    onDragOver: ({ active, over }) =>
      over
        ? `El paso "${labelOf(String(active.id))}" está sobre ${describeTarget(String(over.id))}.`
        : `El paso "${labelOf(String(active.id))}" no está sobre una posición válida.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `El paso "${labelOf(String(active.id))}" se colocó en ${describeTarget(String(over.id))}.`
        : `El paso "${labelOf(String(active.id))}" volvió a su posición original.`,
    onDragCancel: ({ active }) =>
      `Se canceló el movimiento del paso "${labelOf(String(active.id))}".`,
  };

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    setBoard((current) => moveItem(current, String(active.id), String(over.id)));
    setWarning(null);
    setResult(null);
  }

  function handleQuickPlace(stepId: string) {
    setBoard((current) => placeInNextEmptySlot(current, stepId));
    setWarning(null);
    setResult(null);
  }

  function handleRemove(index: number) {
    setBoard((current) => removeFromSlot(current, index));
    setWarning(null);
    setResult(null);
  }

  async function handleSubmit() {
    if (!isComplete(board)) {
      setWarning(
        `Completa el orden de los ${board.sequence.length} pasos antes de enviar tu respuesta.`,
      );
      return;
    }
    setWarning(null);
    const response = await submitAttempt.mutateAsync({
      scenarioId: scenario.scenarioId,
      submittedOrder: board.sequence,
    });
    setResult(response);
  }

  function handleClear() {
    setBoard(createBoard(shuffle(scenario.steps)));
    setWarning(null);
    setResult(null);
  }

  return (
    <>
      <NarrativeCard narrative={scenario.narrative} />

      <div className="card" style={{ marginTop: 16 }}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          accessibility={{ announcements }}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className={styles.workGrid}>
            <StepPool stepIds={board.pool} labels={labels} onQuickPlace={handleQuickPlace} />
            <SequenceSlots
              sequenceIds={board.sequence}
              labels={labels}
              misplacedSteps={result?.misplacedSteps ?? null}
              onRemove={handleRemove}
            />
          </div>

          <DragOverlay>
            {activeId ? (
              <div className={styles.chip}>
                <span className={styles.dot} aria-hidden="true" />
                {labelOf(activeId)}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        <div className={styles.actions}>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSubmit}
            disabled={submitAttempt.isPending}
            data-testid="submit-button"
          >
            {submitAttempt.isPending ? 'Enviando…' : 'Enviar respuesta'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleClear}
            data-testid="clear-button"
          >
            Limpiar
          </button>
          {result && (
            <button
              type="button"
              className="btn-secondary"
              onClick={onRequestNext}
              data-testid="next-button"
            >
              Siguiente caso
            </button>
          )}
        </div>

        <div data-testid="feedback-panel">
          <FeedbackPanel warning={warning} result={result} totalSteps={board.sequence.length} />
        </div>
      </div>
    </>
  );
}
