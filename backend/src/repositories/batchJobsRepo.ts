import { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const STATUS_INDEX = 'GSI1';

export interface BatchJobItem {
  jobId: string;
  templateIds: string[];
  submittedAt: string;
}

function toBatchJob(item: Record<string, unknown>): BatchJobItem {
  return {
    jobId: String(item.PK).replace('BATCHJOB#', ''),
    templateIds: item.templateIds as string[],
    submittedAt: item.submittedAt as string,
  };
}

/**
 * BE-IA.3 — seguimiento de los jobs de batch inference enviados a Bedrock.
 * Reutiliza la tabla `Scenarios` y su GSI1 (partición por `status`) con un
 * espacio de valores propio ('pendiente'/'procesado') que nunca colisiona con
 * los estados de escenario ('borrador', 'publicado', etc.) — así se evita
 * tanto una tabla nueva como un Scan para listar jobs pendientes.
 */
export function createBatchJobsRepo(client: DynamoDBDocumentClient, tableName: string) {
  async function putPendingJob(job: BatchJobItem): Promise<void> {
    await client.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          PK: `BATCHJOB#${job.jobId}`,
          templateIds: job.templateIds,
          submittedAt: job.submittedAt,
          status: 'pendiente',
        },
      }),
    );
  }

  async function listPendingJobs(): Promise<BatchJobItem[]> {
    const result = await client.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: STATUS_INDEX,
        KeyConditionExpression: '#status = :status',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':status': 'pendiente' },
      }),
    );
    return (result.Items ?? []).map(toBatchJob);
  }

  async function markProcessed(jobId: string): Promise<void> {
    await client.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { PK: `BATCHJOB#${jobId}` },
        UpdateExpression: 'SET #status = :processed',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':processed': 'procesado' },
      }),
    );
  }

  return { putPendingJob, listPendingJobs, markProcessed };
}

export type BatchJobsRepo = ReturnType<typeof createBatchJobsRepo>;
