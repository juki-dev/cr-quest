import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { createScenariosRepo } from '../../repositories/scenariosRepo.js';
import { createReviewScenariosHandler } from '../reviewScenarios.js';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const scenariosRepo = createScenariosRepo(ddb, process.env.SCENARIOS_TABLE_NAME!);

export const handler = createReviewScenariosHandler({ scenariosRepo });
