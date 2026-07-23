import {
  BedrockClient,
  CreateModelInvocationJobCommand,
  GetModelInvocationJobCommand,
} from '@aws-sdk/client-bedrock';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import { createBatchJob, getBatchJobStatus } from './bedrockBatchAdapter.js';

const bedrockMock = mockClient(BedrockClient);
const client = new BedrockClient({ region: 'us-east-1' });

beforeEach(() => {
  bedrockMock.reset();
});

describe('createBatchJob', () => {
  it('envía el job con el modelo y las rutas de S3 dadas, devuelve el jobArn como jobId', async () => {
    bedrockMock
      .on(CreateModelInvocationJobCommand)
      .resolves({ jobArn: 'arn:aws:bedrock:us-east-1:123:model-invocation-job/abc' });

    const result = await createBatchJob(client, {
      modelId: 'modelo-sonnet',
      roleArn: 'arn:aws:iam::123:role/batch',
      jobName: 'job-1',
      inputS3Uri: 's3://bucket/input/job-1.jsonl',
      outputS3Uri: 's3://bucket/output/job-1/',
    });

    expect(result).toEqual({ jobId: 'arn:aws:bedrock:us-east-1:123:model-invocation-job/abc' });

    const input = bedrockMock.commandCalls(CreateModelInvocationJobCommand)[0]!.args[0]!.input;
    expect(input.modelId).toBe('modelo-sonnet');
    expect(input.inputDataConfig?.s3InputDataConfig?.s3Uri).toBe('s3://bucket/input/job-1.jsonl');
    expect(input.outputDataConfig?.s3OutputDataConfig?.s3Uri).toBe('s3://bucket/output/job-1/');
  });

  it('lanza un error explícito si Bedrock no devuelve jobArn', async () => {
    bedrockMock.on(CreateModelInvocationJobCommand).resolves({});

    await expect(
      createBatchJob(client, {
        modelId: 'modelo-sonnet',
        roleArn: 'arn:aws:iam::123:role/batch',
        jobName: 'job-1',
        inputS3Uri: 's3://bucket/input/job-1.jsonl',
        outputS3Uri: 's3://bucket/output/job-1/',
      }),
    ).rejects.toThrow(/no devolvió un jobArn/);
  });
});

describe('getBatchJobStatus', () => {
  it('mapea el estado y la ruta de salida del job', async () => {
    bedrockMock.on(GetModelInvocationJobCommand).resolves({
      status: 'Completed',
      outputDataConfig: { s3OutputDataConfig: { s3Uri: 's3://bucket/output/job-1/' } },
    });

    const result = await getBatchJobStatus(client, 'job-1');

    expect(result).toEqual({ status: 'Completed', outputS3Uri: 's3://bucket/output/job-1/' });
  });

  it('usa "Other" como estado por defecto si Bedrock no informa status', async () => {
    bedrockMock.on(GetModelInvocationJobCommand).resolves({});

    const result = await getBatchJobStatus(client, 'job-1');

    expect(result.status).toBe('Other');
  });
});
