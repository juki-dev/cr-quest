import { describe, expect, it } from 'vitest';
import { computeScoreUpdate } from './scoring.js';

describe('computeScoreUpdate', () => {
  it('primer intento de un caso: siempre es nuevo BEST, delta = accuracy completo', () => {
    expect(computeScoreUpdate(undefined, 0.8)).toEqual({
      isNewBest: true,
      isNewCase: true,
      delta: 0.8,
    });
  });

  it('reintento que mejora: delta es solo la diferencia, no el total', () => {
    expect(computeScoreUpdate(0.5, 0.8)).toEqual({
      isNewBest: true,
      isNewCase: false,
      delta: 0.30000000000000004, // 0.8 - 0.5 en aritmética de punto flotante
    });
  });

  it('reintento que empeora: no es nuevo BEST y no aporta delta', () => {
    expect(computeScoreUpdate(0.8, 0.5)).toEqual({
      isNewBest: false,
      isNewCase: false,
      delta: 0,
    });
  });

  it('reintento que empata: no cuenta como mejora (evita sumar dos veces)', () => {
    expect(computeScoreUpdate(0.8, 0.8)).toEqual({
      isNewBest: false,
      isNewCase: false,
      delta: 0,
    });
  });

  it('acumulación sobre varios casos distintos: la suma de los deltas es el total esperado', () => {
    const casos = [
      { previo: undefined, nuevo: 1 },
      { previo: undefined, nuevo: 0.5 },
      { previo: 0.5, nuevo: 0.9 }, // reintento que mejora
      { previo: 0.9, nuevo: 0.2 }, // reintento que empeora, no debe restar
    ];

    let totalPoints = 0;
    let casesCompleted = 0;
    for (const { previo, nuevo } of casos) {
      const update = computeScoreUpdate(previo, nuevo);
      totalPoints += update.delta;
      if (update.isNewCase) casesCompleted++;
    }

    expect(totalPoints).toBeCloseTo(1 + 0.5 + 0.4); // 1.9
    expect(casesCompleted).toBe(2);
  });
});
