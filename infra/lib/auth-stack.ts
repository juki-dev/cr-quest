import { CfnOutput, RemovalPolicy, SecretValue, Stack, StackProps } from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import type { Construct } from 'constructs';

export interface AuthStackProps extends StackProps {
  /** dev | prod. Forma parte del prefijo de dominio y de los nombres de parámetro. */
  readonly stage: string;
  /**
   * Prefijo del dominio Hosted UI de Cognito. Debe ser único a nivel global en la
   * región. Por defecto `cr-quest-<stage>`; si ese prefijo ya está tomado, pásalo
   * por contexto (`-c authDomainPrefix=...`).
   */
  readonly domainPrefix?: string;
  /**
   * URLs a las que Cognito puede redirigir tras autenticar (el callback del BFF).
   * Incluye localhost para la vista previa; agrega el dominio real del frontend
   * cuando se despliegue (Amplify). `http://localhost` es la única excepción a
   * la exigencia de HTTPS de Cognito.
   */
  readonly callbackUrls?: string[];
  /** URLs válidas de retorno tras cerrar sesión en Cognito. */
  readonly logoutUrls?: string[];
}

/**
 * BE-SEC.1/2 — identidad de voluntarios e instructores. `voluntario` es el rol
 * que obtiene cualquier registro; la promoción a `instructor` es una acción
 * manual y deliberada (nunca autoasignable), consistente con RQ-2.6.
 *
 * Autenticación por federación con Google (fe_specs ADR-2, revisado): los
 * voluntarios inician sesión con su cuenta de Google. Cognito federa a Google
 * como IdP y emite sus propios JWT, así el authorizer del API (jwtAudience =
 * este client) sigue funcionando sin cambios. El intercambio del `code` por
 * tokens ocurre server-side en el BFF de Next.js con PKCE (client público, sin
 * secreto), preservando ADR-3.
 */
export class AuthStack extends Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly userPoolDomain: cognito.UserPoolDomain;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    const { stage } = props;
    const domainPrefix =
      props.domainPrefix ?? this.node.tryGetContext('authDomainPrefix') ?? `cr-quest-${stage}`;
    const callbackUrls = props.callbackUrls ?? ['http://localhost:3000/api/auth/callback'];
    const logoutUrls = props.logoutUrls ?? ['http://localhost:3000/login'];

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

    // Credenciales de la OAuth app de Google (Google Cloud Console), creadas
    // fuera de este stack para no exponerlas en el template. El clientId no es
    // secreto (SSM String); el clientSecret sí (Secrets Manager). Ver los
    // nombres de parámetro documentados en fe_specs § 7.
    const googleClientId = ssm.StringParameter.valueForStringParameter(
      this,
      `/cr-quest/${stage}/google/client-id`,
    );
    const googleClientSecret = SecretValue.secretsManager(`cr-quest/${stage}/google-oauth`, {
      jsonField: 'clientSecret',
    });

    const googleIdp = new cognito.UserPoolIdentityProviderGoogle(this, 'GoogleIdp', {
      userPool: this.userPool,
      clientId: googleClientId,
      clientSecretValue: googleClientSecret,
      scopes: ['openid', 'email', 'profile'],
      // Google → atributos estándar del pool. `fullname` es requerido en el pool
      // y lo llena el nombre de la cuenta de Google.
      attributeMapping: {
        email: cognito.ProviderAttribute.GOOGLE_EMAIL,
        fullname: cognito.ProviderAttribute.GOOGLE_NAME,
      },
    });

    // Dominio Hosted UI: expone los endpoints /oauth2/authorize y /oauth2/token
    // que usa el flujo de código. No renderizamos su UI (vamos directo a Google
    // con identity_provider=Google), solo necesitamos sus endpoints OAuth.
    this.userPoolDomain = this.userPool.addDomain('HostedUiDomain', {
      cognitoDomain: { domainPrefix },
    });

    // BE-SEC.3/ADR-3 (fe_specs) — cliente público (sin secreto): el BFF de
    // Next.js intercambia el `code` server-side con PKCE. Mantenemos
    // userPassword/userSrp por si en el futuro se agrega login con email.
    this.userPoolClient = this.userPool.addClient('WebClient', {
      authFlows: { userPassword: true, userSrp: true },
      generateSecret: false,
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
        callbackUrls,
        logoutUrls,
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.GOOGLE,
        cognito.UserPoolClientIdentityProvider.COGNITO,
      ],
    });
    // El client no puede referenciar a Google como IdP soportado antes de que el
    // IdP exista: fuerza el orden de creación en el deploy.
    this.userPoolClient.node.addDependency(googleIdp);

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

    // Valores que necesita el frontend/.env.local para el flujo OAuth.
    new CfnOutput(this, 'UserPoolIdOutput', { value: this.userPool.userPoolId });
    new CfnOutput(this, 'WebClientIdOutput', { value: this.userPoolClient.userPoolClientId });
    new CfnOutput(this, 'HostedUiDomainOutput', { value: this.userPoolDomain.baseUrl() });
  }
}
