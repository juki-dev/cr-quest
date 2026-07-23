import { describe, expect, it } from 'vitest';
import { validateOrder } from './validateOrder.js';

const correct = ['s1', 's2', 's3', 's4', 's5', 's6'];

describe('validateOrder', () => {
  it('orden perfecto: accuracy 1 y sin pasos mal ubicados', () => {
    expect(validateOrder(['s1', 's2', 's3', 's4', 's5', 's6'], correct)).toEqual({
      accuracy: 1,
      misplacedSteps: [],
    });
  });

  it('orden completamente invertido: todos mal ubicados', () => {
    const result = validateOrder(['s6', 's5', 's4', 's3', 's2', 's1'], correct);
    expect(result.accuracy).toBe(0);
    expect(result.misplacedSteps).toHaveLength(6);
  });

  it('dos pasos intercambiados: solo esos dos cuentan como mal ubicados', () => {
    const result = validateOrder(['s2', 's1', 's3', 's4', 's5', 's6'], correct);
    expect(result.accuracy).toBeCloseTo(4 / 6);
    expect(result.misplacedSteps.sort()).toEqual(['s1', 's2']);
  });

  it('lista incompleta: accuracy se calcula solo sobre los pasos presentes', () => {
    const result = validateOrder(['s1', 's2', 's3'], correct);
    expect(result.accuracy).toBeCloseTo(3 / 6);
    expect(result.misplacedSteps).toEqual([]);
  });

  it('paso omitido al inicio: corre todos los siguientes y cuentan como mal ubicados', () => {
    const result = validateOrder(['s2', 's3', 's4', 's5', 's6'], correct);
    expect(result.accuracy).toBe(0);
    expect(result.misplacedSteps).toEqual(['s2', 's3', 's4', 's5', 's6']);
  });

  it('stepId repetido: cada posición se evalúa de forma independiente', () => {
    const result = validateOrder(['s1', 's1', 's3', 's4', 's5', 's6'], correct);
    expect(result.accuracy).toBeCloseTo(5 / 6);
    expect(result.misplacedSteps).toEqual(['s1']);
  });

  it('lista vacía: accuracy 0 sin lanzar error', () => {
    expect(validateOrder([], correct)).toEqual({ accuracy: 0, misplacedSteps: [] });
  });

  it('lista más larga que la correcta: el sobrante no se examina', () => {
    const result = validateOrder(['s1', 's2', 's3', 's4', 's5', 's6', 's7'], correct);
    expect(result.accuracy).toBe(1);
    expect(result.misplacedSteps).toEqual([]);
  });

  it('secuencia correcta vacía: no divide por cero', () => {
    expect(validateOrder(['s1'], [])).toEqual({ accuracy: 0, misplacedSteps: [] });
  });
});
