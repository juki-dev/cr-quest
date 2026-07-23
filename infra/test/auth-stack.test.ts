import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { AuthStack } from '../lib/auth-stack.js';

function synth(): Template {
  const app = new App();
  const stack = new AuthStack(app, 'TestAuthStack');
  return Template.fromStack(stack);
}

describe('AuthStack', () => {
  it('BE-SEC.1 — User Pool con verificación de email y contraseña mínima de 8 caracteres', () => {
    const template = synth();

    template.hasResourceProperties('AWS::Cognito::UserPool', {
      AutoVerifiedAttributes: ['email'],
      Policies: { PasswordPolicy: { MinimumLength: 8 } },
    });
  });

  it('BE-SEC.3/ADR-3 (fe_specs) — App Client sin secreto (BFF server-side)', () => {
    const template = synth();

    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      GenerateSecret: false,
    });
  });

  it('BE-SEC.2 — existen los grupos voluntario e instructor', () => {
    const template = synth();
    const groups = template.findResources('AWS::Cognito::UserPoolGroup');
    const groupNames = Object.values(groups).map(
      (g) => (g as { Properties: { GroupName: string } }).Properties.GroupName,
    );

    expect(groupNames).toContain('voluntario');
    expect(groupNames).toContain('instructor');
    expect(groupNames).toHaveLength(2);
  });
});
