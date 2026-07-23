import { describe, expect, it } from 'vitest';
import { submitAttemptSchema } from './submitAttempt.js';

describe('submitAttemptSchema', () => {
  it('acepta un body válido', () => {
    const result = submitAttemptSchema.safeParse({
      scenarioId: 'scn-1',
      submittedOrder: ['s1', 's2'],
    });
    expect(result.success).toBe(true);
  });

  it('rechaza correctSequence: el cliente nunca puede inyectar la secuencia correcta (BE-API.3)', () => {
    const result = submitAttemptSchema.safeParse({
      scenarioId: 'scn-1',
      submittedOrder: ['s1', 's2'],
      correctSequence: ['s1', 's2'],
    });
    expect(result.success).toBe(false);
  });

  it('rechaza scenarioId vacío', () => {
    expect(submitAttemptSchema.safeParse({ scenarioId: '', submittedOrder: ['s1'] }).success).toBe(
      false,
    );
  });

  it('rechaza submittedOrder vacío', () => {
    expect(
      submitAttemptSchema.safeParse({ scenarioId: 'scn-1', submittedOrder: [] }).success,
    ).toBe(false);
  });

  it('rechaza si falta un campo obligatorio', () => {
    expect(submitAttemptSchema.safeParse({ scenarioId: 'scn-1' }).success).toBe(false);
  });
});
