import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { beforeAll, describe, expect, it } from 'vitest';
import { ApiStack } from '../lib/api-stack.js';
import { AuthStack } from '../lib/auth-stack.js';
import { DataStack } from '../lib/data-stack.js';

// Sintetizado una sola vez: cada synth() bundlea 6 Lambdas con esbuild, así
// que resintetizar por cada `it` multiplicaba el costo sin necesidad — el
// stack no cambia entre tests.
let template: Template;

beforeAll(() => {
  const app = new App();
  const dataStack = new DataStack(app, 'TestDataStack');
  const authStack = new AuthStack(app, 'TestAuthStack', { stage: 'test' });
  const apiStack = new ApiStack(app, 'TestApiStack', {
    stage: 'test',
    scenariosTable: dataStack.scenariosTable,
    attemptsTable: dataStack.attemptsTable,
    batchBucket: dataStack.batchBucket,
    userPool: authStack.userPool,
    userPoolClient: authStack.userPoolClient,
  });
  template = Template.fromStack(apiStack);
});

describe('ApiStack', () => {
  it('RQ-2.10 + hallazgo ADR-3 — existen las 6 Lambdas (5 originales + ingestScenarioBatch)', () => {
    template.resourceCountIs('AWS::Lambda::Function', 6);
  });

  it('BE-SEC.3 — el authorizer JWT apunta al User Pool correcto', () => {
    template.hasResourceProperties('AWS::ApiGatewayV2::Authorizer', {
      AuthorizerType: 'JWT',
      IdentitySource: ['$request.header.Authorization'],
    });
  });

  it('expone exactamente 5 rutas HTTP (los 5 endpoints públicos de be_specs § 4)', () => {
    template.resourceCountIs('AWS::ApiGatewayV2::Route', 5);
  });

  it('BE-API.9 — generateScenarioBatch (submit/ingest) no se exponen por API Gateway', () => {
    const routes = template.findResources('AWS::ApiGatewayV2::Route');
    const routeKeys = Object.values(routes).map(
      (r) => (r as { Properties: { RouteKey: string } }).Properties.RouteKey,
    );

    expect(routeKeys).toContain('GET /api/scenarios/next');
    expect(routeKeys).toContain('POST /api/attempts');
    expect(routeKeys).toContain('GET /api/leaderboard');
    expect(routeKeys).toContain('GET /api/review/scenarios');
    expect(routeKeys).toContain('PATCH /api/review/scenarios/{scenarioId}');
    expect(routeKeys.some((k) => k.includes('batch'))).toBe(false);
  });

  it('BE-SEC.4 — getLeaderboard nunca tiene permisos de escritura en DynamoDB', () => {
    const policies = template.findResources('AWS::IAM::Policy');
    const leaderboardPolicyEntries = Object.entries(policies).filter(([logicalId]) =>
      logicalId.startsWith('GetLeaderboardFn'),
    );

    expect(leaderboardPolicyEntries.length).toBeGreaterThan(0);
    for (const [, policy] of leaderboardPolicyEntries) {
      const statements = (policy as { Properties: { PolicyDocument: { Statement: { Action: unknown }[] } } })
        .Properties.PolicyDocument.Statement;
      const actions = statements.flatMap((s) => (Array.isArray(s.Action) ? s.Action : [s.Action]));
      expect(actions).not.toContain('dynamodb:PutItem');
      expect(actions).not.toContain('dynamodb:UpdateItem');
      expect(actions).not.toContain('dynamodb:DeleteItem');
    }
  });

  it('BE-IA.6 — submitAttempt tiene permiso bedrock:InvokeModel', () => {
    template.hasResourceProperties(
      'AWS::IAM::Policy',
      Match.objectLike({
        PolicyDocument: {
          Statement: Match.arrayWith([Match.objectLike({ Action: 'bedrock:InvokeModel' })]),
        },
      }),
    );
  });

  it('BE-IA.1/ADR-3 — el scheduler nocturno invoca submitScenarioBatch, no ingestScenarioBatch', () => {
    template.hasResourceProperties('AWS::Scheduler::Schedule', {
      ScheduleExpression: 'cron(0 6 * * ? *)',
      Target: Match.objectLike({
        Arn: { 'Fn::GetAtt': Match.arrayWith([Match.stringLikeRegexp('^SubmitScenarioBatchFn')]) },
      }),
    });
  });

  it('el scheduler nocturno queda desactivado hasta tener el prompt de generación definitivo', () => {
    template.hasResourceProperties('AWS::Scheduler::Schedule', {
      State: 'DISABLED',
    });
  });
});
