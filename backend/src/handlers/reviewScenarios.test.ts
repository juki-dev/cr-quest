import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { describe, expect, it, vi } from 'vitest';
import type { ScenarioItem } from '../repositories/scenariosRepo.js';
import { createReviewScenariosHandler } from './reviewScenarios.js';
import { buildEvent, parseBody } from './testUtils.js';

function draft(overrides: Partial<ScenarioItem> = {}): ScenarioItem {
  return {
    scenarioId: 'scn-1',
    templateId: 'tmpl-001',
    narrative: 'narrativa',
    correctSequence: ['s1', 's2'],
    status: 'borrador',
    generatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeDeps() {
  return {
    scenariosRepo: {
      queryByStatus: vi.fn().mockResolvedValue([draft()]),
      transitionStatus: vi.fn().mockResolvedValue(undefined),
    },
  };
}

describe('reviewScenarios handler', () => {
  it('rechaza con 403 si el usuario no es instructor (BE-API.6)', async () => {
    const handler = createReviewScenariosHandler(makeDeps());
    const result = await handler(buildEvent({ groups: ['voluntario'], method: 'GET' }));
    expect(result.statusCode).toBe(403);
  });

  it('GET lista los borradores con la secuencia correcta resuelta a etiquetas', async () => {
    const handler = createReviewScenariosHandler(makeDeps());
    const result = await handler(buildEvent({ groups: ['instructor'], method: 'GET' }));
    const body = parseBody(result) as { scenarios: { correctSequence: { stepId: string; label: string }[] }[] };

    expect(result.statusCode).toBe(200);
    expect(body.scenarios[0]!.correctSequence[0]).toHaveProperty('label');
  });

  it('GET rechaza un status inexistente con 400', async () => {
    const handler = createReviewScenariosHandler(makeDeps());
    const result = await handler(
      buildEvent({ groups: ['instructor'], method: 'GET', queryStringParameters: { status: 'x' } }),
    );
    expect(result.statusCode).toBe(400);
  });

  it('PATCH publicar transiciona borrador -> publicado y registra reviewedBy', async () => {
    const deps = makeDeps();
    const handler = createReviewScenariosHandler(deps);

    const result = await handler(
      buildEvent({
        groups: ['instructor'],
        userId: 'instructor-1',
        method: 'PATCH',
        pathParameters: { scenarioId: 'scn-1' },
        body: { action: 'publicar' },
      }),
    );

    expect(result.statusCode).toBe(200);
    expect(deps.scenariosRepo.transitionStatus).toHaveBeenCalledWith(
      expect.objectContaining({ scenarioId: 'scn-1', from: 'borrador', to: 'publicado', reviewedBy: 'instructor-1' }),
    );
  });

  it('PATCH rechazar transiciona borrador -> rechazado', async () => {
    const deps = makeDeps();
    const handler = createReviewScenariosHandler(deps);

    const result = await handler(
      buildEvent({
        groups: ['instructor'],
        method: 'PATCH',
        pathParameters: { scenarioId: 'scn-1' },
        body: { action: 'rechazar' },
      }),
    );

    expect(result.statusCode).toBe(200);
    expect(deps.scenariosRepo.transitionStatus).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'rechazado' }),
    );
  });

  it('PATCH devuelve 400 si falta scenarioId en la ruta', async () => {
    const handler = createReviewScenariosHandler(makeDeps());
    const result = await handler(
      buildEvent({ groups: ['instructor'], method: 'PATCH', body: { action: 'publicar' } }),
    );
    expect(result.statusCode).toBe(400);
  });

  it('PATCH devuelve 400 si el body no tiene una acción válida', async () => {
    const handler = createReviewScenariosHandler(makeDeps());
    const result = await handler(
      buildEvent({
        groups: ['instructor'],
        method: 'PATCH',
        pathParameters: { scenarioId: 'scn-1' },
        body: { action: 'aprobar' },
      }),
    );
    expect(result.statusCode).toBe(400);
  });

  it('PATCH devuelve 409 si la transición ya no es válida (BE-API.7)', async () => {
    const deps = makeDeps();
    deps.scenariosRepo.transitionStatus = vi
      .fn()
      .mockRejectedValue(new ConditionalCheckFailedException({ message: 'no coincide', $metadata: {} }));
    const handler = createReviewScenariosHandler(deps);

    const result = await handler(
      buildEvent({
        groups: ['instructor'],
        method: 'PATCH',
        pathParameters: { scenarioId: 'scn-1' },
        body: { action: 'publicar' },
      }),
    );
    expect(result.statusCode).toBe(409);
  });

  it('devuelve 405 para métodos no soportados', async () => {
    const handler = createReviewScenariosHandler(makeDeps());
    const result = await handler(buildEvent({ groups: ['instructor'], method: 'DELETE' }));
    expect(result.statusCode).toBe(405);
  });
});
