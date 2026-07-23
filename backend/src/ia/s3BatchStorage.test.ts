import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import { createS3BatchStorage } from './s3BatchStorage.js';

const s3Mock = mockClient(S3Client);
const client = new S3Client({ region: 'us-east-1' });
const storage = createS3BatchStorage(client, 'bedrock-batch-io');

beforeEach(() => {
  s3Mock.reset();
});

describe('uploadBatchInput', () => {
  it('sube el JSONL a input/ y devuelve URIs s3:// consistentes de entrada y salida', async () => {
    s3Mock.on(PutObjectCommand).resolves({});

    const result = await storage.uploadBatchInput('{"a":1}', 'job-2026-01-01');

    expect(result).toEqual({
      inputS3Uri: 's3://bedrock-batch-io/input/job-2026-01-01.jsonl',
      outputS3Uri: 's3://bedrock-batch-io/output/job-2026-01-01/',
    });

    const input = s3Mock.commandCalls(PutObjectCommand)[0]!.args[0]!.input;
    expect(input.Bucket).toBe('bedrock-batch-io');
    expect(input.Key).toBe('input/job-2026-01-01.jsonl');
    expect(input.Body).toBe('{"a":1}');
  });
});

describe('downloadBatchOutput', () => {
  it('parsea el URI s3:// y devuelve el contenido como string', async () => {
    s3Mock.on(GetObjectCommand).resolves({
      Body: { transformToString: async () => 'contenido del batch' } as never,
    });

    const content = await storage.downloadBatchOutput('s3://bedrock-batch-io/output/job-1/');

    expect(content).toBe('contenido del batch');
    const input = s3Mock.commandCalls(GetObjectCommand)[0]!.args[0]!.input;
    expect(input.Bucket).toBe('bedrock-batch-io');
    expect(input.Key).toBe('output/job-1/output.jsonl.out');
  });

  it('lanza un error explícito si la respuesta no trae Body', async () => {
    s3Mock.on(GetObjectCommand).resolves({});

    await expect(storage.downloadBatchOutput('s3://bedrock-batch-io/output/job-1/')).rejects.toThrow(
      /No se pudo leer la salida/,
    );
  });

  it('lanza un error explícito si el URI no tiene forma s3://', async () => {
    await expect(storage.downloadBatchOutput('https://no-es-s3')).rejects.toThrow(/URI de S3 inválida/);
  });
});
