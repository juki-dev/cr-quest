import { ConditionalCheckFailedException, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import { createScenariosRepo } from './scenariosRepo.js';

const ddbMock = mockClient(DynamoDBDocumentClient);
const repo = createScenariosRepo(
  DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' })),
  'Scenarios',
);

beforeEach(() => {
  ddbMock.reset();
});

describe('putScenario', () => {
  it('escribe con PK derivado y condiciona a que no exista (nunca sobreescribe)', async () => {
    ddbMock.on(PutCommand).resolves({});

    await repo.putScenario({
      scenarioId: 'scn-1',
      templateId: 'tmpl-001',
      narrative: 'Un paciente...',
      correctSequence: ['s1', 's2'],
      status: 'borrador',
      generatedAt: '2026-01-01T00:00:00.000Z',
    });

    const input = ddbMock.commandCalls(PutCommand)[0]!.args[0]!.input;
    expect(input.Item?.PK).toBe('SCENARIO#scn-1');
    expect(input.Item?.scenarioId).toBeUndefined();
    expect(input.ConditionExpression).toContain('attribute_not_exists');
  });
});

describe('getScenario', () => {
  it('reconstruye scenarioId a partir de PK', async () => {
    ddbMock.on(GetCommand).resolves({
      Item: {
        PK: 'SCENARIO#scn-1',
        templateId: 'tmpl-001',
        narrative: 'texto',
        correctSequence: ['s1'],
        status: 'publicado',
        generatedAt: '2026-01-01T00:00:00.000Z',
      },
    });

    const scenario = await repo.getScenario('scn-1');
    expect(scenario?.scenarioId).toBe('scn-1');
    expect(scenario?.status).toBe('publicado');
  });

  it('devuelve undefined si el escenario no existe', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    expect(await repo.getScenario('inexistente')).toBeUndefined();
  });
});

describe('queryByStatus', () => {
  it('consulta GSI1 por status, nunca Scan', async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [
        {
          PK: 'SCENARIO#scn-1',
          templateId: 'tmpl-001',
          narrative: 'texto',
          correctSequence: ['s1'],
          status: 'borrador',
          generatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });

    const scenarios = await repo.queryByStatus('borrador');
    expect(scenarios).toHaveLength(1);

    const input = ddbMock.commandCalls(QueryCommand)[0]!.args[0]!.input;
    expect(input.IndexName).toBe('GSI1');
    expect(input.ExpressionAttributeValues?.[':status']).toBe('borrador');
  });
});

describe('transitionStatus', () => {
  it('condiciona la transición al estado de origen (BE-API.7)', async () => {
    ddbMock.on(UpdateCommand).resolves({});

    await repo.transitionStatus({
      scenarioId: 'scn-1',
      from: 'borrador',
      to: 'publicado',
      reviewedBy: 'instructor@example.com',
    });

    const input = ddbMock.commandCalls(UpdateCommand)[0]!.args[0]!.input;
    expect(input.ConditionExpression).toBe('#status = :from');
    expect(input.ExpressionAttributeValues?.[':from']).toBe('borrador');
    expect(input.ExpressionAttributeValues?.[':to']).toBe('publicado');
  });

  it('propaga el rechazo de DynamoDB si el estado de origen no coincide', async () => {
    ddbMock.on(UpdateCommand).rejects(
      new ConditionalCheckFailedException({ message: 'no coincide', $metadata: {} }),
    );

    await expect(
      repo.transitionStatus({
        scenarioId: 'scn-1',
        from: 'borrador',
        to: 'publicado',
        reviewedBy: 'instructor@example.com',
      }),
    ).rejects.toThrow(ConditionalCheckFailedException);
  });

  it('incluye la narrativa editada cuando se provee', async () => {
    ddbMock.on(UpdateCommand).resolves({});

    await repo.transitionStatus({
      scenarioId: 'scn-1',
      from: 'borrador',
      to: 'publicado',
      reviewedBy: 'instructor@example.com',
      narrative: 'narrativa corregida',
    });

    const input = ddbMock.commandCalls(UpdateCommand)[0]!.args[0]!.input;
    expect(input.UpdateExpression).toContain('narrative = :narrative');
    expect(input.ExpressionAttributeValues?.[':narrative']).toBe('narrativa corregida');
  });
});
