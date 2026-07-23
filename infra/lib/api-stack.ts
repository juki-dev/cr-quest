import { fileURLToPath } from 'node:url';
import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as scheduler from 'aws-cdk-lib/aws-scheduler';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import type { Construct } from 'constructs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = `${__dirname}/../..`;
const HANDLERS_ENTRY_DIR = `${REPO_ROOT}/backend/src/handlers/entry`;

// ADR-8 (be_specs.md) — IDs de modelo confirmados con acceso habilitado en la
// cuenta de destino (`aws bedrock list-foundation-models`), resueltos por SSM
// en runtime — nunca hardcodeados en el código de los handlers.
const GENERATION_MODEL_ID = 'anthropic.claude-sonnet-4-6';
const FEEDBACK_MODEL_ID = 'anthropic.claude-haiku-4-5-20251001-v1:0';

export interface ApiStackProps extends StackProps {
  stage: string;
  scenariosTable: dynamodb.Table;
  attemptsTable: dynamodb.Table;
  batchBucket: s3.Bucket;
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
}

export class ApiStack extends Stack {
  public readonly httpApi: apigwv2.HttpApi;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { stage, scenariosTable, attemptsTable, batchBucket, userPool, userPoolClient } = props;

    // ---- ADR-8 — parámetros de configuración de modelos, no secretos de código ----
    new ssm.StringParameter(this, 'GenerationModelIdParam', {
      parameterName: `/cr-quest/${stage}/bedrock/model-id/generacion`,
      stringValue: GENERATION_MODEL_ID,
    });
    new ssm.StringParameter(this, 'FeedbackModelIdParam', {
      parameterName: `/cr-quest/${stage}/bedrock/model-id/feedback`,
      stringValue: FEEDBACK_MODEL_ID,
    });

    // ---- BE-IA — rol que Bedrock (el servicio) asume para leer/escribir el batch ----
    // Distinto del rol de ejecución de los Lambda: este lo asume `bedrock.amazonaws.com`
    // para el job de batch inference en sí (CreateModelInvocationJob's roleArn).
    const bedrockBatchRole = new iam.Role(this, 'BedrockBatchExecutionRole', {
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
    });
    batchBucket.grantRead(bedrockBatchRole, 'input/*');
    batchBucket.grantWrite(bedrockBatchRole, 'output/*');

    const createFunction = (fnId: string, entryFile: string, environment: Record<string, string> = {}) =>
      new NodejsFunction(this, fnId, {
        entry: `${HANDLERS_ENTRY_DIR}/${entryFile}`,
        handler: 'handler',
        runtime: lambda.Runtime.NODEJS_20_X,
        architecture: lambda.Architecture.ARM_64,
        timeout: Duration.seconds(10),
        depsLockFilePath: `${REPO_ROOT}/pnpm-lock.yaml`,
        projectRoot: REPO_ROOT,
        bundling: {
          format: OutputFormat.ESM,
          target: 'node20',
          // Se empaqueta el SDK de AWS en vez de asumir qué viene preinstalado
          // en el runtime — evita "funciona local, falla en Lambda" por un
          // cliente (p.ej. @aws-sdk/client-bedrock) que no venga incluido.
          externalModules: [],
          banner: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
        },
        environment: { STAGE: stage, ...environment },
      });

    // ---- RQ-2.10 — las 6 Lambdas (5 + el hallazgo de ADR-3: ingestScenarioBatch) ----

    const getPublishedScenarioFn = createFunction('GetPublishedScenarioFn', 'getPublishedScenario.ts', {
      SCENARIOS_TABLE_NAME: scenariosTable.tableName,
      ATTEMPTS_TABLE_NAME: attemptsTable.tableName,
    });
    scenariosTable.grantReadData(getPublishedScenarioFn);
    attemptsTable.grantReadData(getPublishedScenarioFn); // BE-API.2, solo lee BEST# para des-priorizar

    const submitAttemptFn = createFunction('SubmitAttemptFn', 'submitAttempt.ts', {
      SCENARIOS_TABLE_NAME: scenariosTable.tableName,
      ATTEMPTS_TABLE_NAME: attemptsTable.tableName,
    });
    scenariosTable.grantReadData(submitAttemptFn);
    attemptsTable.grantReadWriteData(submitAttemptFn);
    submitAttemptFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel'],
        resources: [
          `arn:aws:bedrock:${this.region}::foundation-model/${FEEDBACK_MODEL_ID}`,
        ],
      }),
    );
    ssm.StringParameter.fromStringParameterName(
      this,
      'FeedbackModelIdParamRef',
      `/cr-quest/${stage}/bedrock/model-id/feedback`,
    ).grantRead(submitAttemptFn);

    const getLeaderboardFn = createFunction('GetLeaderboardFn', 'getLeaderboard.ts', {
      ATTEMPTS_TABLE_NAME: attemptsTable.tableName,
    });
    attemptsTable.grantReadData(getLeaderboardFn); // BE-SEC.4 — nunca escribe

    const reviewScenariosFn = createFunction('ReviewScenariosFn', 'reviewScenarios.ts', {
      SCENARIOS_TABLE_NAME: scenariosTable.tableName,
    });
    scenariosTable.grantReadWriteData(reviewScenariosFn);

    const submitScenarioBatchFn = createFunction('SubmitScenarioBatchFn', 'submitScenarioBatch.ts', {
      SCENARIOS_TABLE_NAME: scenariosTable.tableName,
      BATCH_BUCKET_NAME: batchBucket.bucketName,
      BEDROCK_BATCH_ROLE_ARN: bedrockBatchRole.roleArn,
    });
    scenariosTable.grantWriteData(submitScenarioBatchFn); // registra el job pendiente (BE-IA.3)
    batchBucket.grantWrite(submitScenarioBatchFn, 'input/*');
    submitScenarioBatchFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:CreateModelInvocationJob'],
        resources: [`arn:aws:bedrock:${this.region}::foundation-model/${GENERATION_MODEL_ID}`],
      }),
    );
    submitScenarioBatchFn.addToRolePolicy(
      new iam.PolicyStatement({ actions: ['iam:PassRole'], resources: [bedrockBatchRole.roleArn] }),
    );
    ssm.StringParameter.fromStringParameterName(
      this,
      'GenerationModelIdParamRef',
      `/cr-quest/${stage}/bedrock/model-id/generacion`,
    ).grantRead(submitScenarioBatchFn);

    const ingestScenarioBatchFn = createFunction('IngestScenarioBatchFn', 'ingestScenarioBatch.ts', {
      SCENARIOS_TABLE_NAME: scenariosTable.tableName,
      BATCH_BUCKET_NAME: batchBucket.bucketName,
    });
    scenariosTable.grantReadWriteData(ingestScenarioBatchFn);
    batchBucket.grantRead(ingestScenarioBatchFn, 'output/*');
    ingestScenarioBatchFn.addToRolePolicy(
      new iam.PolicyStatement({ actions: ['bedrock:GetModelInvocationJob'], resources: ['*'] }),
    );

    // ---- BE-SEC.3 — HTTP API con JWT authorizer de Cognito ----

    const jwtAuthorizer = new authorizers.HttpJwtAuthorizer(
      'CognitoAuthorizer',
      `https://cognito-idp.${this.region}.amazonaws.com/${userPool.userPoolId}`,
      { jwtAudience: [userPoolClient.userPoolClientId] },
    );

    this.httpApi = new apigwv2.HttpApi(this, 'HttpApi', { apiName: `cr-quest-api-${stage}` });

    this.httpApi.addRoutes({
      path: '/api/scenarios/next',
      methods: [apigwv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration(
        'GetPublishedScenarioIntegration',
        getPublishedScenarioFn,
      ),
      authorizer: jwtAuthorizer,
    });

    this.httpApi.addRoutes({
      path: '/api/attempts',
      methods: [apigwv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration('SubmitAttemptIntegration', submitAttemptFn),
      authorizer: jwtAuthorizer,
    });

    this.httpApi.addRoutes({
      path: '/api/leaderboard',
      methods: [apigwv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration(
        'GetLeaderboardIntegration',
        getLeaderboardFn,
      ),
      authorizer: jwtAuthorizer,
    });

    // BE-API.6 — el rol se verifica también dentro del handler (defensa en profundidad);
    // esto no reemplaza esa verificación, solo exige un JWT válido de cualquier rol.
    this.httpApi.addRoutes({
      path: '/api/review/scenarios',
      methods: [apigwv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration(
        'ReviewScenariosListIntegration',
        reviewScenariosFn,
      ),
      authorizer: jwtAuthorizer,
    });
    this.httpApi.addRoutes({
      path: '/api/review/scenarios/{scenarioId}',
      methods: [apigwv2.HttpMethod.PATCH],
      integration: new integrations.HttpLambdaIntegration(
        'ReviewScenariosActionIntegration',
        reviewScenariosFn,
      ),
      authorizer: jwtAuthorizer,
    });

    // BE-API.9 — generateScenarioBatch (submit/ingest) nunca se expone por API Gateway.
    const schedulerRole = new iam.Role(this, 'SchedulerInvokeRole', {
      assumedBy: new iam.ServicePrincipal('scheduler.amazonaws.com'),
    });
    submitScenarioBatchFn.grantInvoke(schedulerRole);

    new scheduler.CfnSchedule(this, 'NightlyBatchSchedule', {
      flexibleTimeWindow: { mode: 'OFF' },
      scheduleExpression: 'cron(0 6 * * ? *)',
      scheduleExpressionTimezone: 'America/Bogota',
      target: {
        arn: submitScenarioBatchFn.functionArn,
        roleArn: schedulerRole.roleArn,
      },
    });
  }
}
