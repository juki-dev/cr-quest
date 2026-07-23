import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import type { AttemptsRepo } from '../repositories/attemptsRepo.js';
import { leaderboardQuerySchema } from '../schemas/leaderboardQuery.js';
import { getUserId, json } from './httpResponse.js';

export interface GetLeaderboardDeps {
  attemptsRepo: Pick<AttemptsRepo, 'getLeaderboard' | 'getStats' | 'getRankPosition'>;
}

/** BE-API.5 — una Query para el ranking, una lectura puntual + COUNT para la posición propia. */
export function createGetLeaderboardHandler(deps: GetLeaderboardDeps) {
  return async (
    event: APIGatewayProxyEventV2WithJWTAuthorizer,
  ): Promise<APIGatewayProxyStructuredResultV2> => {
    const userId = getUserId(event);
    const parsedQuery = leaderboardQuerySchema.safeParse(event.queryStringParameters ?? {});
    if (!parsedQuery.success) {
      return json(400, { message: 'Parámetros inválidos.', issues: parsedQuery.error.issues });
    }

    const [entries, myStats] = await Promise.all([
      deps.attemptsRepo.getLeaderboard(parsedQuery.data.limit),
      deps.attemptsRepo.getStats(userId),
    ]);

    const totalPoints = myStats?.totalPoints ?? 0;
    const casesCompleted = myStats?.casesCompleted ?? 0;
    const position = await deps.attemptsRepo.getRankPosition(totalPoints);

    return json(200, { entries, me: { position, totalPoints, casesCompleted } });
  };
}
