import type { APIGatewayProxyEvent } from "aws-lambda";

export interface RestApiEventOptions {
  httpMethod: string;
  path: string;
  body?: string | null;
  headers?: Record<string, string>;
  pathParameters?: Record<string, string> | null;
  queryStringParameters?: Record<string, string> | null;
  stage?: string;
  userId?: string;
}

/**
 * API Gateway REST API（ペイロードv1）のテストイベントを生成する。
 */
export function createRestApiEvent(
  options: RestApiEventOptions,
): APIGatewayProxyEvent {
  const userId = options.userId ?? "user-123";
  const stage = options.stage ?? "v1";

  return {
    body: options.body ?? null,
    headers: options.headers ?? {},
    multiValueHeaders: {},
    httpMethod: options.httpMethod,
    isBase64Encoded: false,
    path: options.path,
    pathParameters: options.pathParameters ?? null,
    queryStringParameters: options.queryStringParameters ?? null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: "123456789",
      apiId: "api-id",
      authorizer: {
        principalId: userId,
        integrationLatency: 0,
        claims: { sub: userId },
      },
      protocol: "HTTP/1.1",
      httpMethod: options.httpMethod,
      identity: {
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        clientCert: null,
        principalOrgId: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        sourceIp: "127.0.0.1",
        user: null,
        userAgent: "test",
        userArn: null,
      },
      path: `/${stage}${options.path}`,
      requestId: "req-id",
      requestTime: "01/Jan/2024:00:00:00 +0000",
      requestTimeEpoch: 1704067200000,
      resourceId: "resource-id",
      resourcePath: "/{proxy+}",
      stage,
    },
    resource: "/{proxy+}",
  };
}
