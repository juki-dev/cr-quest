import { BedrockClient } from '@aws-sdk/client-bedrock';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { SCENARIO_TEMPLATES } from '@cr-quest/domain';
import { getBedrockModelConfig } from '../../config.js';
import { createBatchJob } from '../../ia/bedrockBatchAdapter.js';
import { createS3BatchStorage } from '../../ia/s3BatchStorage.js';
import { createBatchJobsRepo } from '../../repositories/batchJobsRepo.js';
import { createSubmitScenarioBatchHandler } from '../submitScenarioBatch.js';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const bedrock = new BedrockClient({});
const storage = createS3BatchStorage(new S3Client({}), process.env.BATCH_BUCKET_NAME!);
const batchJobsRepo = createBatchJobsRepo(ddb, process.env.SCENARIOS_TABLE_NAME!);
const roleArn = process.env.BEDROCK_BATCH_ROLE_ARN!;

// Top-level await: se resuelve una vez por cold start (ADR-8, be_specs.md).
const { generationModelId } = await getBedrockModelConfig(process.env.STAGE ?? 'dev');

export const handler = createSubmitScenarioBatchHandler({
  templates: SCENARIO_TEMPLATES,
  batchJobsRepo,
  modelId: generationModelId,
  uploadBatchInput: storage.uploadBatchInput,
  createBatchJob: (params) => createBatchJob(bedrock, { ...params, roleArn }),
});
