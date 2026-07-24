import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { beforeAll, describe, expect, it } from 'vitest';
import { AuthStack } from '../lib/auth-stack.js';

let template: Template;

beforeAll(() => {
  const app = new App();
  const stack = new AuthStack(app, 'TestAuthStack', { stage: 'test' });
  template = Template.fromStack(stack);
});

describe('AuthStack', () => {
  it('BE-SEC.1 — User Pool con verificación de email y contraseña mínima de 8 caracteres', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      AutoVerifiedAttributes: ['email'],
      Policies: { PasswordPolicy: { MinimumLength: 8 } },
    });
  });

  it('BE-SEC.3/ADR-3 (fe_specs) — App Client sin secreto (BFF server-side)', () => {
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      GenerateSecret: false,
    });
  });

  it('ADR-2 (revisado) — App Client con flujo de código OAuth y Google como IdP soportado', () => {
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      AllowedOAuthFlows: ['code'],
      AllowedOAuthScopes: ['openid', 'email', 'profile'],
      SupportedIdentityProviders: ['Google', 'COGNITO'],
    });
  });

  it('ADR-2 (revisado) — existe el IdP de Google y el dominio Hosted UI', () => {
    template.hasResourceProperties('AWS::Cognito::UserPoolIdentityProvider', {
      ProviderName: 'Google',
      ProviderType: 'Google',
    });
    template.resourceCountIs('AWS::Cognito::UserPoolDomain', 1);
  });

  it('BE-SEC.2 — existen los grupos voluntario e instructor', () => {
    const groups = template.findResources('AWS::Cognito::UserPoolGroup');
    const groupNames = Object.values(groups).map(
      (g) => (g as { Properties: { GroupName: string } }).Properties.GroupName,
    );

    expect(groupNames).toContain('voluntario');
    expect(groupNames).toContain('instructor');
    expect(groupNames).toHaveLength(2);
  });
});
