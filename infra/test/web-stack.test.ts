import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { beforeAll, describe, expect, it } from 'vitest';
import { WebStack } from '../lib/web-stack.js';

let template: Template;

beforeAll(() => {
  const app = new App();
  const stack = new WebStack(app, 'TestWebStack', {
    stage: 'test',
    apiUrl: 'https://api.example.com',
    cognitoDomain: 'https://cr-quest-test.auth.us-east-1.amazoncognito.com',
    cognitoClientId: 'client-123',
  });
  template = Template.fromStack(stack);
});

describe('WebStack', () => {
  it('ADR-7 — la app de Amplify es WEB_COMPUTE (Next.js SSR)', () => {
    template.hasResourceProperties('AWS::Amplify::App', {
      Platform: 'WEB_COMPUTE',
      Repository: 'https://github.com/juki-dev/cr-quest',
    });
  });

  it('ADR-7 — env vars estáticas inyectadas desde los outputs de otros stacks', () => {
    template.hasResourceProperties('AWS::Amplify::App', {
      EnvironmentVariables: Match.arrayWith([
        { Name: 'AMPLIFY_MONOREPO_APP_ROOT', Value: 'frontend' },
        { Name: 'BACKEND_API_URL', Value: 'https://api.example.com' },
        { Name: 'COGNITO_CLIENT_ID', Value: 'client-123' },
      ]),
    });
  });

  it('la branch main tiene auto-build y las env vars derivadas del dominio', () => {
    template.hasResourceProperties('AWS::Amplify::Branch', {
      BranchName: 'main',
      EnableAutoBuild: true,
      EnvironmentVariables: Match.arrayWith([
        Match.objectLike({ Name: 'APP_BASE_URL' }),
        Match.objectLike({ Name: 'OAUTH_REDIRECT_URI' }),
      ]),
    });
  });

  it('el App Client no aparece en claro: el PAT se referencia vía Secrets Manager', () => {
    const apps = template.findResources('AWS::Amplify::App');
    const app = Object.values(apps)[0] as { Properties: { AccessToken: string } };
    expect(app.Properties.AccessToken).toContain('{{resolve:secretsmanager:cr-quest/github-token');
  });

  it('existe un rol de servicio de Amplify', () => {
    template.hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Principal: { Service: 'amplify.amazonaws.com' },
          }),
        ]),
      }),
    });
  });
});
