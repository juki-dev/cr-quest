import { CfnOutput, SecretValue, Stack, StackProps } from 'aws-cdk-lib';
import * as amplify from 'aws-cdk-lib/aws-amplify';
import * as iam from 'aws-cdk-lib/aws-iam';
import type { Construct } from 'constructs';

export interface WebStackProps extends StackProps {
  readonly stage: string;
  /** Endpoint del API Gateway (BACKEND_API_URL). Viene de ApiStack.httpApi.apiEndpoint. */
  readonly apiUrl: string;
  /** Dominio Hosted UI de Cognito (COGNITO_DOMAIN). Viene de AuthStack.userPoolDomain.baseUrl(). */
  readonly cognitoDomain: string;
  /** ID del App Client web (COGNITO_CLIENT_ID). Viene de AuthStack.userPoolClient. */
  readonly cognitoClientId: string;
  readonly repoOwner?: string;
  readonly repoName?: string;
  readonly branchName?: string;
  /**
   * Nombre del secreto de Secrets Manager con el PAT de GitHub (SecretString
   * plano). Amplify lo usa para clonar el repo y buildear en cada push.
   */
  readonly githubTokenSecretName?: string;
}

/**
 * ADR-7 — hosting del frontend con AWS Amplify Hosting, plataforma WEB_COMPUTE
 * (Next.js SSR nativo), en la misma cuenta AWS. El frontend usa el patrón BFF
 * (ADR-3), así que necesita runtime de servidor: no se puede exportar estático.
 *
 * Este stack define SOLO la app de Amplify (repo, branch, build spec, env vars).
 * El build real de Next.js lo corre Amplify en cada push a la branch conectada
 * — es un pipeline aparte del de GitHub Actions, que sigue desplegando la infra.
 */
export class WebStack extends Stack {
  constructor(scope: Construct, id: string, props: WebStackProps) {
    super(scope, id, props);

    const {
      stage,
      apiUrl,
      cognitoDomain,
      cognitoClientId,
      repoOwner = 'juki-dev',
      repoName = 'cr-quest',
      branchName = 'main',
      githubTokenSecretName = 'cr-quest/github-token',
    } = props;

    // Rol de servicio de Amplify (build + compute SSR). Política administrada
    // que AWS provee para el rol de servicio de Amplify.
    const serviceRole = new iam.Role(this, 'AmplifyServiceRole', {
      assumedBy: new iam.ServicePrincipal('amplify.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess-Amplify'),
      ],
    });

    // El PAT vive en Secrets Manager; el template solo lleva la referencia
    // dinámica ({{resolve:secretsmanager:...}}), nunca el token en claro.
    const githubToken = SecretValue.secretsManager(githubTokenSecretName).unsafeUnwrap();

    // Build spec del monorepo pnpm: la app está en /frontend. pnpm resuelve el
    // workspace desde ahí usando el lockfile de la raíz.
    const buildSpec = [
      'version: 1',
      'applications:',
      '  - appRoot: frontend',
      '    frontend:',
      '      phases:',
      '        preBuild:',
      '          commands:',
      '            - nvm use 20',
      '            - npm install -g pnpm@10',
      '            - pnpm install --frozen-lockfile',
      '        build:',
      '          commands:',
      '            - pnpm run build',
      '      artifacts:',
      '        baseDirectory: .next',
      '        files:',
      "          - '**/*'",
      '      cache:',
      '        paths:',
      "          - .next/cache/**/*",
    ].join('\n');

    const amplifyApp = new amplify.CfnApp(this, 'FrontendApp', {
      name: `cr-quest-${stage}`,
      repository: `https://github.com/${repoOwner}/${repoName}`,
      accessToken: githubToken,
      platform: 'WEB_COMPUTE',
      iamServiceRole: serviceRole.roleArn,
      buildSpec,
      // Env vars estáticas (no dependen del dominio de Amplify).
      environmentVariables: [
        { name: 'AMPLIFY_MONOREPO_APP_ROOT', value: 'frontend' },
        { name: 'BACKEND_API_URL', value: apiUrl },
        { name: 'COGNITO_DOMAIN', value: cognitoDomain },
        { name: 'COGNITO_CLIENT_ID', value: cognitoClientId },
      ],
    });

    // URL pública de la branch. Se calcula desde el dominio de la app (un recurso
    // distinto), así no hay auto-referencia. Las env vars que dependen de esta
    // URL van en la branch, no en la app.
    const appBaseUrl = `https://${branchName}.${amplifyApp.attrDefaultDomain}`;

    const branch = new amplify.CfnBranch(this, 'Branch', {
      appId: amplifyApp.attrAppId,
      branchName,
      stage: 'PRODUCTION',
      enableAutoBuild: true,
      framework: 'Next.js - SSR',
      environmentVariables: [
        { name: 'APP_BASE_URL', value: appBaseUrl },
        { name: 'OAUTH_REDIRECT_URI', value: `${appBaseUrl}/api/auth/callback` },
      ],
    });

    new CfnOutput(this, 'AmplifyAppIdOutput', { value: amplifyApp.attrAppId });
    new CfnOutput(this, 'FrontendUrlOutput', {
      value: appBaseUrl,
      description:
        'URL pública del frontend. Pásala como contexto `-c frontendUrl=<url>` y redesplega el AuthStack para registrar el callback en Cognito.',
    });
    new CfnOutput(this, 'OAuthRedirectUriOutput', {
      value: `${appBaseUrl}/api/auth/callback`,
      description: 'Debe figurar en los callbackUrls del App Client (AuthStack) y en la OAuth app de Google.',
    });
    // Referencia la branch para que el linter no la marque sin usar; su creación
    // es el efecto deseado.
    void branch;
  }
}
