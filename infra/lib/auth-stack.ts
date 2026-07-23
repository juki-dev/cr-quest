import { RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import type { Construct } from 'constructs';

/**
 * BE-SEC.1/2 — identidad de voluntarios e instructores. `voluntario` es el rol
 * que obtiene cualquier registro; la promoción a `instructor` es una acción
 * manual y deliberada (nunca autoasignable), consistente con RQ-2.6.
 */
export class AuthStack extends Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'cr-quest-voluntarios',
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: { fullname: { required: true, mutable: true } },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: false,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // BE-SEC.3/ADR-3 (fe_specs) — cliente público: el BFF de Next.js llama a
    // Cognito server-side, sin secreto de cliente que proteger.
    this.userPoolClient = this.userPool.addClient('WebClient', {
      authFlows: { userPassword: true, userSrp: true },
      generateSecret: false,
    });

    new cognito.CfnUserPoolGroup(this, 'VoluntarioGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'voluntario',
      description: 'Rol por defecto. La asignación al registrarse es un paso operativo del piloto.',
    });

    new cognito.CfnUserPoolGroup(this, 'InstructorGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'instructor',
      description: 'Asignación manual — habilita el panel de revisión (BE-API.6).',
    });
  }
}
