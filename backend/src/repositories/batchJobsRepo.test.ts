import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import { createBatchJobsRepo } from './batchJobsRepo.js';

const ddbMock = mockClient(DynamoDBDocumentClient);
const repo = createBatchJobsRepo(
  DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' })),
  'Scenarios',
);

beforeEach(() => {
  ddbMock.reset();
});

describe('putPendingJob', () => {
  it('guarda el job con status "pendiente" en el mismo espacio de GSI1', async () => {
    ddbMock.on(PutCommand).resolves({});

    await repo.putPendingJob({
      jobId: 'job-1',
      templateIds: ['tmpl-001', 'tmpl-002'],
      submittedAt: '2026-01-01T00:00:00.000Z',
    });

    const input = ddbMock.commandCalls(PutCommand)[0]!.args[0]!.input;
    expect(input.Item?.PK).toBe('BATCHJOB#job-1');
    expect(input.Item?.status).toBe('pendiente');
  });
});

describe('listPendingJobs', () => {
  it('consulta GSI1 por status = pendiente, nunca Scan', async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [{ PK: 'BATCHJOB#job-1', templateIds: ['tmpl-001'], submittedAt: '2026-01-01T00:00:00.000Z' }],
    });

    const jobs = await repo.listPendingJobs();

    expect(jobs).toEqual([
      { jobId: 'job-1', templateIds: ['tmpl-001'], submittedAt: '2026-01-01T00:00:00.000Z' },
    ]);
    const input = ddbMock.commandCalls(QueryCommand)[0]!.args[0]!.input;
    expect(input.IndexName).toBe('GSI1');
    expect(input.ExpressionAttributeValues?.[':status']).toBe('pendiente');
  });
});

describe('markProcessed', () => {
  it('transiciona el job a procesado', async () => {
    ddbMock.on(UpdateCommand).resolves({});

    await repo.markProcessed('job-1');

    const input = ddbMock.commandCalls(UpdateCommand)[0]!.args[0]!.input;
    expect(input.Key).toEqual({ PK: 'BATCHJOB#job-1' });
    expect(input.ExpressionAttributeValues?.[':processed']).toBe('procesado');
  });
});
