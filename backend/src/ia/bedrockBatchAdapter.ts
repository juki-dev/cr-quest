import {
  BedrockClient,
  CreateModelInvocationJobCommand,
  GetModelInvocationJobCommand,
} from '@aws-sdk/client-bedrock';

export interface CreateBatchJobParams {
  modelId: string;
  roleArn: string;
  jobName: string;
  inputS3Uri: string;
  outputS3Uri: string;
}

export type BedrockBatchJobStatus = 'InProgress' | 'Completed' | 'Failed' | 'Stopped' | 'Other';

/**
 * ADR-3 (be_specs.md § 1) — envoltorio delgado sobre la API de batch inference
 * de Bedrock, deliberadamente angosto: el resto del sistema (orquestación,
 * tests) depende de esta interfaz, no del SDK directo, así que un cambio en el
 * shape exacto de la API solo se corrige aquí.
 */
export async function createBatchJob(
  client: BedrockClient,
  params: CreateBatchJobParams,
): Promise<{ jobId: string }> {
  const result = await client.send(
    new CreateModelInvocationJobCommand({
      modelId: params.modelId,
      roleArn: params.roleArn,
      jobName: params.jobName,
      inputDataConfig: { s3InputDataConfig: { s3Uri: params.inputS3Uri } },
      outputDataConfig: { s3OutputDataConfig: { s3Uri: params.outputS3Uri } },
    }),
  );
  if (!result.jobArn) {
    throw new Error('Bedrock no devolvió un jobArn para el batch enviado.');
  }
  return { jobId: result.jobArn };
}

export async function getBatchJobStatus(
  client: BedrockClient,
  jobId: string,
): Promise<{ status: BedrockBatchJobStatus; outputS3Uri?: string }> {
  const result = await client.send(new GetModelInvocationJobCommand({ jobIdentifier: jobId }));
  return {
    status: (result.status as BedrockBatchJobStatus | undefined) ?? 'Other',
    outputS3Uri: result.outputDataConfig?.s3OutputDataConfig?.s3Uri,
  };
}
