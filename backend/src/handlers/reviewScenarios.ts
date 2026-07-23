import { ASSESSMENT_STEPS } from '@cr-quest/domain';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import type { ScenariosRepo } from '../repositories/scenariosRepo.js';
import { reviewActionSchema, reviewQuerySchema } from '../schemas/reviewAction.js';
import { getGroups, getUserId, json } from './httpResponse.js';

const stepLabels = Object.fromEntries(ASSESSMENT_STEPS.map((s) => [s.stepId, s.label]));

export interface ReviewScenariosDeps {
  scenariosRepo: Pick<ScenariosRepo, 'queryByStatus' | 'transitionStatus'>;
}

/**
 * BE-API.6/7/8 — un solo Lambda atiende listar borradores (GET) y publicar o
 * rechazar (PATCH), igual que lo enumera RQ-2.10. El rol se verifica aquí
 * además de en el authorizer de API Gateway (defensa en profundidad, BE-SEC.4):
 * un JWT de `voluntario` nunca debe poder ejecutar esto, así llegue directo al Lambda.
 */
export function createReviewScenariosHandler(deps: ReviewScenariosDeps) {
  return async (
    event: APIGatewayProxyEventV2WithJWTAuthorizer,
  ): Promise<APIGatewayProxyStructuredResultV2> => {
    if (!getGroups(event).includes('instructor')) {
      return json(403, { message: 'Esta acción requiere rol de instructor.' });
    }

    const method = event.requestContext.http.method;
    if (method === 'GET') return handleList(event, deps);
    if (method === 'PATCH') return handleAction(event, deps);
    return json(405, { message: 'Método no soportado.' });
  };
}

async function handleList(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  deps: ReviewScenariosDeps,
): Promise<APIGatewayProxyStructuredResultV2> {
  const parsedQuery = reviewQuerySchema.safeParse(event.queryStringParameters ?? {});
  if (!parsedQuery.success) {
    return json(400, { message: 'Parámetros inválidos.', issues: parsedQuery.error.issues });
  }

  const scenarios = await deps.scenariosRepo.queryByStatus(parsedQuery.data.status);

  return json(200, {
    scenarios: scenarios.map((scenario) => ({
      ...scenario,
      correctSequence: scenario.correctSequence.map((stepId) => ({
        stepId,
        label: stepLabels[stepId] ?? stepId,
      })),
    })),
  });
}

async function handleAction(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  deps: ReviewScenariosDeps,
): Promise<APIGatewayProxyStructuredResultV2> {
  const scenarioId = event.pathParameters?.scenarioId;
  if (!scenarioId) {
    return json(400, { message: 'Falta scenarioId en la ruta.' });
  }

  let payload: unknown;
  try {
    payload = event.body ? JSON.parse(event.body) : undefined;
  } catch {
    return json(400, { message: 'El body no es JSON válido.' });
  }

  const parsed = reviewActionSchema.safeParse(payload);
  if (!parsed.success) {
    return json(400, { message: 'Solicitud inválida.', issues: parsed.error.issues });
  }

  const reviewedBy = getUserId(event);
  const to = parsed.data.action === 'publicar' ? 'publicado' : 'rechazado';

  try {
    await deps.scenariosRepo.transitionStatus({
      scenarioId,
      from: 'borrador',
      to,
      reviewedBy,
      narrative: parsed.data.narrative,
    });
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      // BE-API.7 — la única transición válida es borrador -> publicado/rechazado.
      return json(409, { message: 'El escenario ya no está en borrador.' });
    }
    throw error;
  }

  return json(200, { scenarioId, status: to });
}
