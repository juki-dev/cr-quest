import { TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { computeScoreUpdate } from '../domain/scoring.js';

const LEADERBOARD_INDEX = 'LeaderboardIndex';

export interface AttemptInput {
  userId: string;
  scenarioId: string;
  submittedOrder: string[];
  accuracy: number;
  displayName?: string;
}

export interface RecordAttemptResult {
  isNewBest: boolean;
  totalPoints: number;
  casesCompleted: number;
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  totalPoints: number;
  casesCompleted: number;
}

/**
 * BE-DATA.3/4 + BE-DOM.3 — acceso a la tabla `Attempts` (single-table).
 * Recibe el cliente ya construido para que los tests puedan inyectar uno
 * mockeado (aws-sdk-client-mock) sin tocar variables de entorno.
 */
export function createAttemptsRepo(client: DynamoDBDocumentClient, tableName: string) {
  async function getBestAccuracy(userId: string, scenarioId: string): Promise<number | undefined> {
    const result = await client.send(
      new GetCommand({
        TableName: tableName,
        Key: { PK: `USER#${userId}`, SK: `BEST#${scenarioId}` },
        ConsistentRead: true,
      }),
    );
    return result.Item?.accuracy as number | undefined;
  }

  async function getStats(
    userId: string,
  ): Promise<{ totalPoints: number; casesCompleted: number; displayName: string } | undefined> {
    const result = await client.send(
      new GetCommand({
        TableName: tableName,
        Key: { PK: `USER#${userId}`, SK: 'STATS' },
        ConsistentRead: true,
      }),
    );
    if (!result.Item) return undefined;
    return {
      totalPoints: result.Item.totalPoints as number,
      casesCompleted: result.Item.casesCompleted as number,
      displayName: result.Item.displayName as string,
    };
  }

  /**
   * BE-DOM.3 — secuencia completa de un intento: lee el BEST previo, decide con
   * `computeScoreUpdate` (pura) si mejora, y si mejora escribe ATTEMPT + BEST +
   * STATS en una única transacción condicionada al BEST anterior. Si el intento
   * no mejora, solo se registra el histórico.
   *
   * La condición de la transacción protege contra la carrera "dos intentos
   * concurrentes leen el mismo BEST anterior": si otro intento ya escribió un
   * BEST mejor entre la lectura y esta escritura, la transacción se cancela y
   * el intento actual se trata como "no fue mejora" (BE-DOM.4). No se inspecciona
   * `CancellationReasons` para distinguir esa causa de otras — simplificación
   * aceptable a la escala del piloto; RQ-6.7 es la red de seguridad.
   */
  async function recordAttempt(input: AttemptInput): Promise<RecordAttemptResult> {
    const { userId, scenarioId, submittedOrder, accuracy } = input;
    const timestamp = new Date().toISOString();
    const attemptItem = {
      PK: `USER#${userId}`,
      SK: `ATTEMPT#${timestamp}#${scenarioId}`,
      submittedOrder,
      accuracy,
      scenarioId,
    };

    const previousBest = await getBestAccuracy(userId, scenarioId);
    const { isNewBest, isNewCase, delta } = computeScoreUpdate(previousBest, accuracy);
    const stats = await getStats(userId);
    const totalPointsBefore = stats?.totalPoints ?? 0;
    const casesCompletedBefore = stats?.casesCompleted ?? 0;

    if (!isNewBest) {
      await client.send(new PutCommand({ TableName: tableName, Item: attemptItem }));
      return {
        isNewBest: false,
        totalPoints: totalPointsBefore,
        casesCompleted: casesCompletedBefore,
      };
    }

    const totalPointsAfter = totalPointsBefore + delta;
    const casesCompletedAfter = isNewCase ? casesCompletedBefore + 1 : casesCompletedBefore;

    try {
      await client.send(
        new TransactWriteCommand({
          TransactItems: [
            { Put: { TableName: tableName, Item: attemptItem } },
            {
              Put: {
                TableName: tableName,
                Item: {
                  PK: `USER#${userId}`,
                  SK: `BEST#${scenarioId}`,
                  accuracy,
                  submittedOrder,
                  updatedAt: timestamp,
                },
                ConditionExpression: 'attribute_not_exists(accuracy) OR accuracy < :nuevo',
                ExpressionAttributeValues: { ':nuevo': accuracy },
              },
            },
            {
              Put: {
                TableName: tableName,
                Item: {
                  PK: `USER#${userId}`,
                  SK: 'STATS',
                  recordType: 'STATS',
                  totalPoints: totalPointsAfter,
                  casesCompleted: casesCompletedAfter,
                  displayName: input.displayName ?? stats?.displayName ?? 'Voluntario',
                },
              },
            },
          ],
        }),
      );
    } catch (error) {
      if (error instanceof TransactionCanceledException) {
        return {
          isNewBest: false,
          totalPoints: totalPointsBefore,
          casesCompleted: casesCompletedBefore,
        };
      }
      throw error;
    }

    return { isNewBest: true, totalPoints: totalPointsAfter, casesCompleted: casesCompletedAfter };
  }

  /** BE-API.5 / BE-DATA.4 — una sola Query descendente sobre el GSI disperso de STATS. */
  async function getLeaderboard(limit: number): Promise<LeaderboardEntry[]> {
    const result = await client.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: LEADERBOARD_INDEX,
        KeyConditionExpression: 'recordType = :recordType',
        ExpressionAttributeValues: { ':recordType': 'STATS' },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return (result.Items ?? []).map((item) => ({
      userId: String(item.PK).replace('USER#', ''),
      displayName: item.displayName as string,
      totalPoints: item.totalPoints as number,
      casesCompleted: item.casesCompleted as number,
    }));
  }

  /** BE-API.2 — casos que el usuario ya intentó, para la política "menos practicado". */
  async function getAttemptedScenarioIds(userId: string): Promise<string[]> {
    const result = await client.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: { ':pk': `USER#${userId}`, ':prefix': 'BEST#' },
      }),
    );
    return (result.Items ?? []).map((item) => String(item.SK).replace('BEST#', ''));
  }

  /**
   * BE-API.5 — posición exacta sin traer todo el ranking: un Query con
   * `Select: COUNT` sobre el mismo GSI cuenta cuántos usuarios tienen más
   * puntos, que es la posición (0-based) del usuario. Solo hace falta conocer
   * su `totalPoints` (STATS ya se leyó o se lee aparte).
   */
  async function getRankPosition(totalPoints: number): Promise<number> {
    const result = await client.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: LEADERBOARD_INDEX,
        KeyConditionExpression: 'recordType = :recordType AND totalPoints > :points',
        ExpressionAttributeValues: { ':recordType': 'STATS', ':points': totalPoints },
        Select: 'COUNT',
      }),
    );
    return (result.Count ?? 0) + 1;
  }

  return {
    getBestAccuracy,
    getStats,
    recordAttempt,
    getLeaderboard,
    getAttemptedScenarioIds,
    getRankPosition,
  };
}

export type AttemptsRepo = ReturnType<typeof createAttemptsRepo>;
