import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

function parseS3Uri(uri: string): { bucket: string; key: string } {
  const match = /^s3:\/\/([^/]+)\/(.*)$/.exec(uri);
  if (!match) throw new Error(`URI de S3 inválida: ${uri}`);
  return { bucket: match[1]!, key: match[2]! };
}

/**
 * BE-DATA.6 — sube/lee el JSONL de entrada y salida del batch inference desde
 * el bucket `bedrock-batch-io`. El nombre exacto del objeto de salida dentro
 * del prefijo lo decide Bedrock al completar el job (convención `<prefijo><nombre-de-entrada>.out`
 * es la esperada a la fecha de escritura) — verificar contra la salida real de
 * un job al desplegar, mismo hallazgo de ADR-3 sobre el batch inference asíncrono.
 */
export function createS3BatchStorage(client: S3Client, bucket: string) {
  async function uploadBatchInput(
    jsonl: string,
    jobName: string,
  ): Promise<{ inputS3Uri: string; outputS3Uri: string }> {
    const inputKey = `input/${jobName}.jsonl`;
    const outputPrefix = `output/${jobName}/`;

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: inputKey,
        Body: jsonl,
        ContentType: 'application/jsonl',
      }),
    );

    return {
      inputS3Uri: `s3://${bucket}/${inputKey}`,
      outputS3Uri: `s3://${bucket}/${outputPrefix}`,
    };
  }

  async function downloadBatchOutput(outputS3Uri: string): Promise<string> {
    const { bucket: outputBucket, key: outputKey } = parseS3Uri(outputS3Uri);
    const result = await client.send(
      new GetObjectCommand({ Bucket: outputBucket, Key: `${outputKey}output.jsonl.out` }),
    );
    const body = await result.Body?.transformToString();
    if (!body) {
      throw new Error(`No se pudo leer la salida del batch en ${outputS3Uri}`);
    }
    return body;
  }

  return { uploadBatchInput, downloadBatchOutput };
}
