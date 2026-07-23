import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { createAttemptsRepo } from '../../repositories/attemptsRepo.js';
import { createGetLeaderboardHandler } from '../getLeaderboard.js';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const attemptsRepo = createAttemptsRepo(ddb, process.env.ATTEMPTS_TABLE_NAME!);

export const handler = createGetLeaderboardHandler({ attemptsRepo });
