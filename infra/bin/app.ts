#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { ApiStack } from '../lib/api-stack.js';
import { AuthStack } from '../lib/auth-stack.js';
import { DataStack } from '../lib/data-stack.js';

const app = new App();

const stage = app.node.tryGetContext('stage') ?? 'dev';
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION };

const dataStack = new DataStack(app, `CrQuest-Data-${stage}`, { env });
const authStack = new AuthStack(app, `CrQuest-Auth-${stage}`, { env });

new ApiStack(app, `CrQuest-Api-${stage}`, {
  env,
  stage,
  scenariosTable: dataStack.scenariosTable,
  attemptsTable: dataStack.attemptsTable,
  batchBucket: dataStack.batchBucket,
  userPool: authStack.userPool,
  userPoolClient: authStack.userPoolClient,
});
