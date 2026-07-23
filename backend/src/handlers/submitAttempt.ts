import { ASSESSMENT_STEPS } from '@cr-quest/domain';
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { validateOrder } from '../domain/validateOrder.js';
import type { FeedbackPromptInput } from '../ia/prompts/feedback.js';
import type { AttemptsRepo } from '../repositories/attemptsRepo.js';
import type { ScenariosRepo } from '../repositories/scenariosRepo.js';
import { submitAttemptSchema } from '../schemas/submitAttempt.js';
import { getUserId, json } from './httpResponse.js';

const stepLabels = Object.fromEntries(ASSESSMENT_STEPS.map((s) => [s.stepId, s.label]));
const labelOf = (id: string) => stepLabels[id] ?? id;

export interface SubmitAttemptDeps {
  scenariosRepo: Pick<ScenariosRepo, 'getScenario'>;
  attemptsRepo: Pick<AttemptsRepo, 'recordAttempt'>;
  generateFeedback: (input: FeedbackPromptInput) => Promise<string | null>;
}

/**
 * BE-API.3/BE-API.4/BE-IA.6/BE-IA.7 — el backend resuelve `correctSequence`
 * internamente por `scenarioId`; nunca confía en uno que venga del cliente
 * (el esquema Zod ya lo rechaza si viniera). El feedback de IA es best-effort:
 * su falla nunca bloquea la respuesta del cálculo de puntaje.
 */
export function createSubmitAttemptHandler(deps: SubmitAttemptDeps) {
  return async (
    event: APIGatewayProxyEventV2WithJWTAuthorizer,
  ): Promise<APIGatewayProxyStructuredResultV2> => {
    const userId = getUserId(event);

    let payload: unknown;
    try {
      payload = event.body ? JSON.parse(event.body) : undefined;
    } catch {
      return json(400, { message: 'El body no es JSON válido.' });
    }

    const parsed = submitAttemptSchema.safeParse(payload);
    if (!parsed.success) {
      return json(400, { message: 'Solicitud inválida.', issues: parsed.error.issues });
    }
    const { scenarioId, submittedOrder } = parsed.data;

    const scenario = await deps.scenariosRepo.getScenario(scenarioId);
    if (!scenario || scenario.status !== 'publicado') {
      // BE-API.4 — 404, no 403: no confirma si el escenario existe en otro estado.
      return json(404, { message: 'Caso no encontrado.' });
    }

    const { accuracy, misplacedSteps } = validateOrder(submittedOrder, scenario.correctSequence);

    const attemptResult = await deps.attemptsRepo.recordAttempt({
      userId,
      scenarioId,
      submittedOrder,
      accuracy,
    });

    const explanation = await deps.generateFeedback({
      narrative: scenario.narrative,
      correctSequenceLabels: scenario.correctSequence.map(labelOf),
      submittedOrderLabels: submittedOrder.map(labelOf),
      misplacedStepLabels: misplacedSteps.map(labelOf),
    });

    return json(200, {
      accuracy,
      misplacedSteps,
      isNewBest: attemptResult.isNewBest,
      totalPoints: attemptResult.totalPoints,
      casesCompleted: attemptResult.casesCompleted,
      explanation,
    });
  };
}
