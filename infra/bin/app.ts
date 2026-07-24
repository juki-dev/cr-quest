#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { ApiStack } from '../lib/api-stack.js';
import { AuthStack } from '../lib/auth-stack.js';
import { DataStack } from '../lib/data-stack.js';
import { WebStack } from '../lib/web-stack.js';

const app = new App();

const stage = app.node.tryGetContext('stage') ?? 'dev';
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION };

// URL pública del frontend en Amplify. No se conoce hasta el primer deploy del
// WebStack; después se pasa como `-c frontendUrl=https://main.<appId>.amplifyapp.com`
// y se redesplega el AuthStack para registrar el callback en Cognito (ver README
// de infra, despliegue en dos fases).
const frontendUrl: string | undefined = app.node.tryGetContext('frontendUrl');

const callbackUrls = ['http://localhost:3000/api/auth/callback'];
const logoutUrls = ['http://localhost:3000/login'];
if (frontendUrl) {
  callbackUrls.push(`${frontendUrl}/api/auth/callback`);
  logoutUrls.push(`${frontendUrl}/login`);
}

const dataStack = new DataStack(app, `CrQuest-Data-${stage}`, { env });
const authStack = new AuthStack(app, `CrQuest-Auth-${stage}`, {
  env,
  stage,
  callbackUrls,
  logoutUrls,
});

const apiStack = new ApiStack(app, `CrQuest-Api-${stage}`, {
  env,
  stage,
  scenariosTable: dataStack.scenariosTable,
  attemptsTable: dataStack.attemptsTable,
  batchBucket: dataStack.batchBucket,
  userPool: authStack.userPool,
  userPoolClient: authStack.userPoolClient,
});

new WebStack(app, `CrQuest-Web-${stage}`, {
  env,
  stage,
  apiUrl: apiStack.httpApi.apiEndpoint,
  cognitoDomain: authStack.userPoolDomain.baseUrl(),
  cognitoClientId: authStack.userPoolClient.userPoolClientId,
});
