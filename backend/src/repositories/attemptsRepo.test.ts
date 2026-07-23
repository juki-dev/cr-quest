import { DynamoDBClient, TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import { createAttemptsRepo } from './attemptsRepo.js';

const ddbMock = mockClient(DynamoDBDocumentClient);
const repo = createAttemptsRepo(
  DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' })),
  'Attempts',
);

beforeEach(() => {
  ddbMock.reset();
});

describe('recordAttempt', () => {
  it('primer intento de un caso: siempre se vuelve BEST, casesCompleted +1', async () => {
    ddbMock.on(GetCommand, { Key: { PK: 'USER#u1', SK: 'BEST#scn-1' } }).resolves({ Item: undefined });
    ddbMock.on(GetCommand, { Key: { PK: 'USER#u1', SK: 'STATS' } }).resolves({ Item: undefined });
    ddbMock.on(TransactWriteCommand).resolves({});

    const result = await repo.recordAttempt({
      userId: 'u1',
      scenarioId: 'scn-1',
      submittedOrder: ['s1', 's2'],
      accuracy: 0.8,
    });

    expect(result).toEqual({ isNewBest: true, totalPoints: 0.8, casesCompleted: 1 });

    const transactCall = ddbMock.commandCalls(TransactWriteCommand)[0]!.args[0]!.input;
    const items = transactCall.TransactItems ?? [];
    expect(items).toHaveLength(3);
    expect(items[1]!.Put?.ConditionExpression).toContain('attribute_not_exists');
    expect(items[2]!.Put?.Item?.totalPoints).toBe(0.8);
    expect(items[2]!.Put?.Item?.casesCompleted).toBe(1);
  });

  it('reintento que mejora: el delta se suma al total existente, casesCompleted no cambia', async () => {
    ddbMock.on(GetCommand, { Key: { PK: 'USER#u1', SK: 'BEST#scn-1' } }).resolves({ Item: { accuracy: 0.5 } });
    ddbMock
      .on(GetCommand, { Key: { PK: 'USER#u1', SK: 'STATS' } })
      .resolves({ Item: { totalPoints: 0.5, casesCompleted: 1, displayName: 'Ana' } });
    ddbMock.on(TransactWriteCommand).resolves({});

    const result = await repo.recordAttempt({
      userId: 'u1',
      scenarioId: 'scn-1',
      submittedOrder: ['s1', 's2'],
      accuracy: 0.9,
    });

    expect(result.isNewBest).toBe(true);
    expect(result.totalPoints).toBeCloseTo(0.9);
    expect(result.casesCompleted).toBe(1);

    const transactCall = ddbMock.commandCalls(TransactWriteCommand)[0]!.args[0]!.input;
    const items = transactCall.TransactItems ?? [];
    expect(items[2]!.Put?.Item?.displayName).toBe('Ana');
  });

  it('reintento que empeora: no dispara transacción, BEST y STATS quedan intactos', async () => {
    ddbMock.on(GetCommand, { Key: { PK: 'USER#u1', SK: 'BEST#scn-1' } }).resolves({ Item: { accuracy: 0.9 } });
    ddbMock
      .on(GetCommand, { Key: { PK: 'USER#u1', SK: 'STATS' } })
      .resolves({ Item: { totalPoints: 0.9, casesCompleted: 1, displayName: 'Ana' } });
    ddbMock.on(PutCommand).resolves({});

    const result = await repo.recordAttempt({
      userId: 'u1',
      scenarioId: 'scn-1',
      submittedOrder: ['s2', 's1'],
      accuracy: 0.5,
    });

    expect(result).toEqual({ isNewBest: false, totalPoints: 0.9, casesCompleted: 1 });
    expect(ddbMock.commandCalls(TransactWriteCommand)).toHaveLength(0);
    // El intento igual queda registrado en el histórico (RQ-6.4).
    expect(ddbMock.commandCalls(PutCommand)).toHaveLength(1);
    expect(ddbMock.commandCalls(PutCommand)[0]!.args[0]!.input.Item?.accuracy).toBe(0.5);
  });

  it('carrera entre dos intentos concurrentes: la transacción cancelada no se propaga como error', async () => {
    ddbMock.on(GetCommand, { Key: { PK: 'USER#u1', SK: 'BEST#scn-1' } }).resolves({ Item: { accuracy: 0.4 } });
    ddbMock
      .on(GetCommand, { Key: { PK: 'USER#u1', SK: 'STATS' } })
      .resolves({ Item: { totalPoints: 0.4, casesCompleted: 1, displayName: 'Ana' } });
    ddbMock.on(TransactWriteCommand).rejects(
      new TransactionCanceledException({
        message: 'cancelled',
        $metadata: {},
        CancellationReasons: [{ Code: 'None' }, { Code: 'ConditionalCheckFailed' }, { Code: 'None' }],
      }),
    );

    const result = await repo.recordAttempt({
      userId: 'u1',
      scenarioId: 'scn-1',
      submittedOrder: ['s1'],
      accuracy: 0.7,
    });

    expect(result).toEqual({ isNewBest: false, totalPoints: 0.4, casesCompleted: 1 });
  });
});

describe('getLeaderboard', () => {
  it('consulta el GSI disperso de STATS ordenado descendente', async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [
        { PK: 'USER#u1', displayName: 'Ana', totalPoints: 14.8, casesCompleted: 12 },
        { PK: 'USER#u2', displayName: 'Beto', totalPoints: 9.1, casesCompleted: 8 },
      ],
    });

    const entries = await repo.getLeaderboard(50);

    expect(entries).toEqual([
      { userId: 'u1', displayName: 'Ana', totalPoints: 14.8, casesCompleted: 12 },
      { userId: 'u2', displayName: 'Beto', totalPoints: 9.1, casesCompleted: 8 },
    ]);

    const queryInput = ddbMock.commandCalls(QueryCommand)[0]!.args[0]!.input;
    expect(queryInput.IndexName).toBe('LeaderboardIndex');
    expect(queryInput.ScanIndexForward).toBe(false);
  });
});

describe('getRankPosition', () => {
  it('cuenta cuántos usuarios tienen más puntos, vía Select COUNT (sin traer todo el ranking)', async () => {
    ddbMock.on(QueryCommand).resolves({ Count: 3 });

    const position = await repo.getRankPosition(11.9);

    expect(position).toBe(4);
    const input = ddbMock.commandCalls(QueryCommand)[0]!.args[0]!.input;
    expect(input.Select).toBe('COUNT');
    expect(input.ExpressionAttributeValues?.[':points']).toBe(11.9);
  });

  it('el primer lugar (nadie con más puntos) da posición 1', async () => {
    ddbMock.on(QueryCommand).resolves({ Count: 0 });
    expect(await repo.getRankPosition(100)).toBe(1);
  });
});
