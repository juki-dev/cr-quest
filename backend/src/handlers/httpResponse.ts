import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

export function json(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export function getUserId(event: APIGatewayProxyEventV2WithJWTAuthorizer): string {
  return event.requestContext.authorizer.jwt.claims.sub as string;
}

/** BE-SEC.2/BE-API.6 — el grupo viaja en el claim `cognito:groups` del JWT. */
export function getGroups(event: APIGatewayProxyEventV2WithJWTAuthorizer): string[] {
  const raw = event.requestContext.authorizer.jwt.claims['cognito:groups'];
  if (!raw) return [];
  return Array.isArray(raw) ? (raw as string[]) : String(raw).split(',');
}
