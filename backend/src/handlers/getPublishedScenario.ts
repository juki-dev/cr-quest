import { ASSESSMENT_STEPS } from '@cr-quest/domain';
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import type { AttemptsRepo } from '../repositories/attemptsRepo.js';
import type { ScenariosRepo } from '../repositories/scenariosRepo.js';
import { getUserId, json } from './httpResponse.js';

const stepLabels = Object.fromEntries(ASSESSMENT_STEPS.map((s) => [s.stepId, s.label]));

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

export interface GetPublishedScenarioDeps {
  scenariosRepo: Pick<ScenariosRepo, 'queryByStatus'>;
  attemptsRepo: Pick<AttemptsRepo, 'getAttemptedScenarioIds'>;
}

/**
 * BE-API.1 — nunca expone `correctSequence` ni ningún campo del que se derive
 * el orden correcto. BE-API.2 — prioriza casos que el usuario no ha intentado
 * todavía; si ya los intentó todos, vuelve a elegir entre los publicados.
 */
export function createGetPublishedScenarioHandler(deps: GetPublishedScenarioDeps) {
  return async (
    event: APIGatewayProxyEventV2WithJWTAuthorizer,
  ): Promise<APIGatewayProxyStructuredResultV2> => {
    const userId = getUserId(event);
    const [published, attemptedIds] = await Promise.all([
      deps.scenariosRepo.queryByStatus('publicado'),
      deps.attemptsRepo.getAttemptedScenarioIds(userId),
    ]);

    if (published.length === 0) {
      return json(404, { message: 'No hay casos publicados disponibles.' });
    }

    const attemptedSet = new Set(attemptedIds);
    const unattempted = published.filter((s) => !attemptedSet.has(s.scenarioId));
    const pool = unattempted.length > 0 ? unattempted : published;
    const chosen = pool[Math.floor(Math.random() * pool.length)]!;

    return json(200, {
      scenarioId: chosen.scenarioId,
      narrative: chosen.narrative,
      steps: shuffle(
        chosen.correctSequence.map((stepId) => ({ stepId, label: stepLabels[stepId] ?? stepId })),
      ),
    });
  };
}
