import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { getBedrockModelConfig } from '../../config.js';
import { generateFeedback } from '../../ia/bedrockClient.js';
import { createAttemptsRepo } from '../../repositories/attemptsRepo.js';
import { createScenariosRepo } from '../../repositories/scenariosRepo.js';
import { createSubmitAttemptHandler } from '../submitAttempt.js';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const bedrock = new BedrockRuntimeClient({});
const scenariosRepo = createScenariosRepo(ddb, process.env.SCENARIOS_TABLE_NAME!);
const attemptsRepo = createAttemptsRepo(ddb, process.env.ATTEMPTS_TABLE_NAME!);

// Top-level await: se resuelve una vez por cold start, no en cada invocación
// (ADR-8, be_specs.md) — Node 20 + ESM soporta await de nivel superior.
const { feedbackModelId } = await getBedrockModelConfig(process.env.STAGE ?? 'dev');

export const handler = createSubmitAttemptHandler({
  scenariosRepo,
  attemptsRepo,
  generateFeedback: (input) => generateFeedback(bedrock, feedbackModelId, input),
});
