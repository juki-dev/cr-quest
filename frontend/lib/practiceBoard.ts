import { arrayMove } from '@dnd-kit/sortable';
import type { ScenarioStep } from '@/lib/types';

/**
 * Estado y transiciones puras del tablero de práctica (pool <-> slots numerados).
 * Aisladas de dnd-kit para poder testearlas sin simular eventos de arrastre.
 */
export interface BoardState {
  pool: string[];
  sequence: string[]; // longitud fija; "__empty-N" cuando el slot N está vacío
}

export function isEmptySlot(id: string): boolean {
  return id.startsWith('__empty-');
}

export function createBoard(steps: ScenarioStep[]): BoardState {
  return {
    pool: steps.map((s) => s.stepId),
    sequence: steps.map((_, i) => `__empty-${i}`),
  };
}

export function isComplete(board: BoardState): boolean {
  return board.sequence.every((id) => !isEmptySlot(id));
}

function reorderPool(board: BoardState, activeId: string, overId: string): BoardState {
  const oldIndex = board.pool.indexOf(activeId);
  const newIndex = board.pool.indexOf(overId);
  if (oldIndex === -1 || newIndex === -1) return board;
  return { ...board, pool: arrayMove(board.pool, oldIndex, newIndex) };
}

function swapSlots(board: BoardState, activeId: string, overId: string): BoardState {
  const i = board.sequence.indexOf(activeId);
  const j = board.sequence.indexOf(overId);
  if (i === -1 || j === -1 || i === j) return board;
  const sequence = [...board.sequence];
  [sequence[i], sequence[j]] = [sequence[j], sequence[i]];
  return { ...board, sequence };
}

export function moveFromPoolToSlot(
  board: BoardState,
  stepId: string,
  slotIndex: number,
): BoardState {
  const poolIndex = board.pool.indexOf(stepId);
  if (poolIndex === -1 || slotIndex < 0 || slotIndex >= board.sequence.length) return board;
  const pool = board.pool.filter((id) => id !== stepId);
  const sequence = [...board.sequence];
  const bumped = sequence[slotIndex];
  sequence[slotIndex] = stepId;
  if (!isEmptySlot(bumped)) pool.push(bumped);
  return { pool, sequence };
}

export function moveFromSlotToPool(
  board: BoardState,
  stepId: string,
  poolTargetIndex?: number,
): BoardState {
  const slotIndex = board.sequence.indexOf(stepId);
  if (slotIndex === -1) return board;
  const sequence = [...board.sequence];
  sequence[slotIndex] = `__empty-${slotIndex}`;
  const pool = [...board.pool];
  if (poolTargetIndex !== undefined && poolTargetIndex >= 0 && poolTargetIndex <= pool.length) {
    pool.splice(poolTargetIndex, 0, stepId);
  } else {
    pool.push(stepId);
  }
  return { pool, sequence };
}

export function placeInNextEmptySlot(board: BoardState, stepId: string): BoardState {
  const slotIndex = board.sequence.findIndex(isEmptySlot);
  if (slotIndex === -1) return board;
  return moveFromPoolToSlot(board, stepId, slotIndex);
}

export function removeFromSlot(board: BoardState, slotIndex: number): BoardState {
  const stepId = board.sequence[slotIndex];
  if (!stepId || isEmptySlot(stepId)) return board;
  return moveFromSlotToPool(board, stepId);
}

/** Dispatcher usado por el onDragEnd de dnd-kit: infiere el tipo de movimiento a partir de dónde vive `activeId` y `overId`. */
export function moveItem(board: BoardState, activeId: string, overId: string): BoardState {
  if (activeId === overId) return board;

  const activeInPool = board.pool.includes(activeId);
  const activeInSequence = board.sequence.includes(activeId);
  if (!activeInPool && !activeInSequence) return board;

  const overIsContainer = overId === 'pool' || overId === 'sequence';
  const overInPool = !overIsContainer && board.pool.includes(overId);
  const overInSequence = !overIsContainer && board.sequence.includes(overId);

  if (activeInPool && overInPool) return reorderPool(board, activeId, overId);
  if (activeInPool && overId === 'pool') return board;

  if (activeInSequence && overInSequence) return swapSlots(board, activeId, overId);
  if (activeInSequence && overId === 'sequence') return board;

  if (activeInPool && (overInSequence || overId === 'sequence')) {
    const slotIndex = overInSequence
      ? board.sequence.indexOf(overId)
      : board.sequence.findIndex(isEmptySlot);
    if (slotIndex === -1) return board;
    return moveFromPoolToSlot(board, activeId, slotIndex);
  }

  if (activeInSequence && (overInPool || overId === 'pool')) {
    const poolIndex = overInPool ? board.pool.indexOf(overId) : undefined;
    return moveFromSlotToPool(board, activeId, poolIndex);
  }

  return board;
}
