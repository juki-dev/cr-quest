import { describe, expect, it } from 'vitest';
import {
  createBoard,
  isComplete,
  moveItem,
  placeInNextEmptySlot,
  removeFromSlot,
} from './practiceBoard';

const steps = [
  { stepId: 'a', label: 'A' },
  { stepId: 'b', label: 'B' },
  { stepId: 'c', label: 'C' },
];

describe('createBoard', () => {
  it('arranca con todo en el pool y slots vacíos', () => {
    const board = createBoard(steps);
    expect(board.pool).toEqual(['a', 'b', 'c']);
    expect(board.sequence).toEqual(['__empty-0', '__empty-1', '__empty-2']);
    expect(isComplete(board)).toBe(false);
  });
});

describe('moveItem: pool -> slot', () => {
  it('mueve un paso del pool a un slot vacío', () => {
    const board = createBoard(steps);
    const next = moveItem(board, 'a', '__empty-1');
    expect(next.pool).toEqual(['b', 'c']);
    expect(next.sequence).toEqual(['__empty-0', 'a', '__empty-2']);
  });

  it('si el slot destino ya tiene un paso, ese paso vuelve al pool', () => {
    let board = createBoard(steps);
    board = moveItem(board, 'a', '__empty-0');
    // El slot 0 ya no se llama "__empty-0": ahora lo identifica el paso que contiene ('a'),
    // igual que dnd-kit reportaría `over.id: 'a'` al soltar sobre un slot ocupado.
    board = moveItem(board, 'b', 'a');
    expect(board.sequence[0]).toBe('b');
    expect(board.pool).toContain('a');
  });
});

describe('moveItem: slot -> slot', () => {
  it('intercambia el contenido de dos slots', () => {
    let board = createBoard(steps);
    board = moveItem(board, 'a', '__empty-0');
    board = moveItem(board, 'b', '__empty-1');
    board = moveItem(board, board.sequence[0], board.sequence[1]);
    expect(board.sequence[0]).toBe('b');
    expect(board.sequence[1]).toBe('a');
  });
});

describe('moveItem: slot -> pool', () => {
  it('deja el slot vacío y agrega el paso de vuelta al pool', () => {
    let board = createBoard(steps);
    board = moveItem(board, 'a', '__empty-0');
    board = moveItem(board, 'a', 'pool');
    expect(board.sequence[0]).toBe('__empty-0');
    expect(board.pool).toContain('a');
  });
});

describe('placeInNextEmptySlot / removeFromSlot', () => {
  it('coloca en el primer slot libre y permite quitarlo de nuevo', () => {
    let board = createBoard(steps);
    board = placeInNextEmptySlot(board, 'c');
    expect(board.sequence[0]).toBe('c');

    board = removeFromSlot(board, 0);
    expect(board.sequence[0]).toBe('__empty-0');
    expect(board.pool).toContain('c');
  });

  it('no hace nada si ya no hay slots libres', () => {
    let board = createBoard(steps);
    board = placeInNextEmptySlot(board, 'a');
    board = placeInNextEmptySlot(board, 'b');
    board = placeInNextEmptySlot(board, 'c');
    expect(isComplete(board)).toBe(true);

    const unchanged = placeInNextEmptySlot(board, 'a');
    expect(unchanged).toEqual(board);
  });
});

describe('moveItem: reordenar dentro del pool', () => {
  it('reordena sin perder ningún elemento', () => {
    const board = createBoard(steps);
    const next = moveItem(board, 'a', 'c');
    expect(next.pool.sort()).toEqual(['a', 'b', 'c']);
    expect(next.sequence).toEqual(board.sequence);
  });
});
