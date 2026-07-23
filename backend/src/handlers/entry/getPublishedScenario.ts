import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { createAttemptsRepo } from '../../repositories/attemptsRepo.js';
import { createScenariosRepo } from '../../repositories/scenariosRepo.js';
import { createGetPublishedScenarioHandler } from '../getPublishedScenario.js';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const scenariosRepo = createScenariosRepo(ddb, process.env.SCENARIOS_TABLE_NAME!);
const attemptsRepo = createAttemptsRepo(ddb, process.env.ATTEMPTS_TABLE_NAME!);

export const handler = createGetPublishedScenarioHandler({ scenariosRepo, attemptsRepo });
