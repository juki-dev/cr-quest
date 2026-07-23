import { describe, expect, it, vi } from 'vitest';
import type { ScenarioItem } from '../repositories/scenariosRepo.js';
import { createSubmitAttemptHandler } from './submitAttempt.js';
import { buildEvent, parseBody } from './testUtils.js';

function scenario(overrides: Partial<ScenarioItem> = {}): ScenarioItem {
  return {
    scenarioId: 'scn-1',
    templateId: 'tmpl-001',
    narrative: 'narrativa',
    correctSequence: ['s1', 's2', 's3'],
    status: 'publicado',
    generatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeDeps(overrides: Partial<Parameters<typeof createSubmitAttemptHandler>[0]> = {}) {
  return {
    scenariosRepo: { getScenario: vi.fn().mockResolvedValue(scenario()) },
    attemptsRepo: {
      recordAttempt: vi.fn().mockResolvedValue({ isNewBest: true, totalPoints: 1, casesCompleted: 1 }),
    },
    generateFeedback: vi.fn().mockResolvedValue('explicación'),
    ...overrides,
  };
}

describe('submitAttempt handler', () => {
  it('rechaza un body inválido con 400', async () => {
    const handler = createSubmitAttemptHandler(makeDeps());
    const result = await handler(buildEvent({ body: { scenarioId: 'scn-1' } }));
    expect(result.statusCode).toBe(400);
  });

  it('rechaza si el cliente intenta inyectar correctSequence (BE-API.3)', async () => {
    const handler = createSubmitAttemptHandler(makeDeps());
    const result = await handler(
      buildEvent({
        body: { scenarioId: 'scn-1', submittedOrder: ['s1'], correctSequence: ['s1'] },
      }),
    );
    expect(result.statusCode).toBe(400);
  });

  it('devuelve 404 si el escenario no existe', async () => {
    const deps = makeDeps({ scenariosRepo: { getScenario: vi.fn().mockResolvedValue(undefined) } });
    const handler = createSubmitAttemptHandler(deps);
    const result = await handler(
      buildEvent({ body: { scenarioId: 'inexistente', submittedOrder: ['s1'] } }),
    );
    expect(result.statusCode).toBe(404);
  });

  it('devuelve 404 (no 403) si el escenario existe pero no está publicado (BE-API.4)', async () => {
    const deps = makeDeps({
      scenariosRepo: { getScenario: vi.fn().mockResolvedValue(scenario({ status: 'borrador' })) },
    });
    const handler = createSubmitAttemptHandler(deps);
    const result = await handler(
      buildEvent({ body: { scenarioId: 'scn-1', submittedOrder: ['s1'] } }),
    );
    expect(result.statusCode).toBe(404);
  });

  it('calcula accuracy contra el correctSequence del servidor, no confía en el cliente', async () => {
    const deps = makeDeps();
    const handler = createSubmitAttemptHandler(deps);

    const result = await handler(
      buildEvent({
        userId: 'u1',
        body: { scenarioId: 'scn-1', submittedOrder: ['s1', 's3', 's2'] },
      }),
    );
    const body = parseBody(result) as { accuracy: number; misplacedSteps: string[] };

    expect(result.statusCode).toBe(200);
    expect(body.accuracy).toBeCloseTo(1 / 3);
    expect(body.misplacedSteps.sort()).toEqual(['s2', 's3']);
    expect(deps.attemptsRepo.recordAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', scenarioId: 'scn-1', accuracy: 1 / 3 }),
    );
  });

  it('degrada a explanation null si la IA falla, sin afectar el resto de la respuesta (BE-IA.7)', async () => {
    const deps = makeDeps({ generateFeedback: vi.fn().mockResolvedValue(null) });
    const handler = createSubmitAttemptHandler(deps);

    const result = await handler(
      buildEvent({ body: { scenarioId: 'scn-1', submittedOrder: ['s1', 's2', 's3'] } }),
    );
    const body = parseBody(result) as { explanation: string | null; accuracy: number };

    expect(result.statusCode).toBe(200);
    expect(body.explanation).toBeNull();
    expect(body.accuracy).toBe(1);
  });

  it('propaga isNewBest/totalPoints/casesCompleted tal como los calcula el repositorio', async () => {
    const deps = makeDeps({
      attemptsRepo: {
        recordAttempt: vi.fn().mockResolvedValue({ isNewBest: false, totalPoints: 4.2, casesCompleted: 5 }),
      },
    });
    const handler = createSubmitAttemptHandler(deps);

    const result = await handler(
      buildEvent({ body: { scenarioId: 'scn-1', submittedOrder: ['s1'] } }),
    );
    const body = parseBody(result) as { isNewBest: boolean; totalPoints: number; casesCompleted: number };

    expect(body).toMatchObject({ isNewBest: false, totalPoints: 4.2, casesCompleted: 5 });
  });
});
