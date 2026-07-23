import { describe, expect, it, vi } from 'vitest';
import type { ScenarioItem } from '../repositories/scenariosRepo.js';
import { createGetPublishedScenarioHandler } from './getPublishedScenario.js';
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

describe('getPublishedScenario handler', () => {
  it('devuelve 404 si no hay ningún caso publicado', async () => {
    const handler = createGetPublishedScenarioHandler({
      scenariosRepo: { queryByStatus: vi.fn().mockResolvedValue([]) },
      attemptsRepo: { getAttemptedScenarioIds: vi.fn().mockResolvedValue([]) },
    });

    const result = await handler(buildEvent());
    expect(result.statusCode).toBe(404);
  });

  it('nunca incluye correctSequence en la respuesta (BE-API.1)', async () => {
    const handler = createGetPublishedScenarioHandler({
      scenariosRepo: { queryByStatus: vi.fn().mockResolvedValue([scenario()]) },
      attemptsRepo: { getAttemptedScenarioIds: vi.fn().mockResolvedValue([]) },
    });

    const result = await handler(buildEvent());
    const body = parseBody(result) as Record<string, unknown>;

    expect(result.statusCode).toBe(200);
    expect(body).not.toHaveProperty('correctSequence');
    expect(JSON.stringify(body)).not.toContain('correctSequence');
  });

  it('prioriza casos no intentados por el usuario (BE-API.2)', async () => {
    const attempted = scenario({ scenarioId: 'scn-attempted' });
    const fresh = scenario({ scenarioId: 'scn-fresh' });
    const handler = createGetPublishedScenarioHandler({
      scenariosRepo: { queryByStatus: vi.fn().mockResolvedValue([attempted, fresh]) },
      attemptsRepo: { getAttemptedScenarioIds: vi.fn().mockResolvedValue(['scn-attempted']) },
    });

    const result = await handler(buildEvent());
    const body = parseBody(result) as { scenarioId: string };
    expect(body.scenarioId).toBe('scn-fresh');
  });

  it('si ya intentó todos los publicados, vuelve a elegir entre ellos', async () => {
    const only = scenario({ scenarioId: 'scn-1' });
    const handler = createGetPublishedScenarioHandler({
      scenariosRepo: { queryByStatus: vi.fn().mockResolvedValue([only]) },
      attemptsRepo: { getAttemptedScenarioIds: vi.fn().mockResolvedValue(['scn-1']) },
    });

    const result = await handler(buildEvent());
    expect(result.statusCode).toBe(200);
    expect((parseBody(result) as { scenarioId: string }).scenarioId).toBe('scn-1');
  });

  it('los pasos devueltos son los mismos stepId que correctSequence, solo mezclados', async () => {
    const handler = createGetPublishedScenarioHandler({
      scenariosRepo: { queryByStatus: vi.fn().mockResolvedValue([scenario()]) },
      attemptsRepo: { getAttemptedScenarioIds: vi.fn().mockResolvedValue([]) },
    });

    const result = await handler(buildEvent());
    const body = parseBody(result) as { steps: { stepId: string; label: string }[] };
    expect(body.steps.map((s) => s.stepId).sort()).toEqual(['s1', 's2', 's3']);
    expect(body.steps.every((s) => typeof s.label === 'string')).toBe(true);
  });
});
