import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';

interface BuildEventOptions {
  userId?: string;
  groups?: string[];
  body?: unknown;
  queryStringParameters?: Record<string, string>;
  pathParameters?: Record<string, string>;
  method?: string;
}

/** Fixture mínimo de un evento de API Gateway HTTP API con JWT authorizer — solo test scaffolding. */
export function buildEvent(options: BuildEventOptions = {}): APIGatewayProxyEventV2WithJWTAuthorizer {
  const {
    userId = 'user-1',
    groups = ['voluntario'],
    body,
    queryStringParameters,
    pathParameters,
    method = 'GET',
  } = options;

  return {
    version: '2.0',
    routeKey: '$default',
    rawPath: '/',
    rawQueryString: '',
    headers: {},
    requestContext: {
      accountId: '123456789012',
      apiId: 'api-id',
      domainName: 'example.com',
      domainPrefix: 'example',
      http: {
        method,
        path: '/',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'vitest',
      },
      requestId: 'req-1',
      routeKey: '$default',
      stage: '$default',
      time: '2026-01-01T00:00:00Z',
      timeEpoch: 0,
      authorizer: {
        jwt: {
          claims: { sub: userId, 'cognito:groups': groups.join(',') },
          scopes: [],
        },
      },
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    isBase64Encoded: false,
    queryStringParameters,
    pathParameters,
  } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;
}

export function parseBody(result: { body?: string }): unknown {
  return result.body ? JSON.parse(result.body) : undefined;
}
