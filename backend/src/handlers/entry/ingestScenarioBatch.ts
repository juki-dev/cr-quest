import { BedrockClient } from '@aws-sdk/client-bedrock';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { SCENARIO_TEMPLATES } from '@cr-quest/domain';
import { getBatchJobStatus } from '../../ia/bedrockBatchAdapter.js';
import { createS3BatchStorage } from '../../ia/s3BatchStorage.js';
import { createBatchJobsRepo } from '../../repositories/batchJobsRepo.js';
import { createScenariosRepo } from '../../repositories/scenariosRepo.js';
import { createIngestScenarioBatchHandler } from '../ingestScenarioBatch.js';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const bedrock = new BedrockClient({});
const storage = createS3BatchStorage(new S3Client({}), process.env.BATCH_BUCKET_NAME!);
const batchJobsRepo = createBatchJobsRepo(ddb, process.env.SCENARIOS_TABLE_NAME!);
const scenariosRepo = createScenariosRepo(ddb, process.env.SCENARIOS_TABLE_NAME!);

export const handler = createIngestScenarioBatchHandler({
  batchJobsRepo,
  scenariosRepo,
  templates: SCENARIO_TEMPLATES,
  getJobStatus: (jobId) => getBatchJobStatus(bedrock, jobId),
  downloadBatchOutput: storage.downloadBatchOutput,
});
