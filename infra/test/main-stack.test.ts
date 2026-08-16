import { describe, it, expect, beforeAll } from "vitest";
import * as cdk from "aws-cdk-lib";
import { Template, Match } from "aws-cdk-lib/assertions";
import { MainStack } from "../src/main-stack.js";

let testTemplate: Template | undefined;

function createTestStack(): Template {
  if (testTemplate) {
    return testTemplate;
  }

  const app = new cdk.App();
  const stack = new MainStack(app, "TestStack", {
    productSlug: "testapp",
    envName: "dev",
    env: {
      account: "123456789012",
      region: "us-east-1",
    },
  });
  testTemplate = Template.fromStack(stack);
  return testTemplate;
}

beforeAll(() => {
  createTestStack();
});

describe("MainStack - Storage", () => {
  it("creates S3 bucket with Block Public Access", () => {
    const template = createTestStack();

    template.hasResourceProperties("AWS::S3::Bucket", {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
  });

  it("creates S3 bucket with AES256 encryption", () => {
    const template = createTestStack();

    template.hasResourceProperties("AWS::S3::Bucket", {
      BucketEncryption: {
        ServerSideEncryptionConfiguration: [
          {
            ServerSideEncryptionByDefault: {
              SSEAlgorithm: "AES256",
            },
          },
        ],
      },
    });
  });

  it("creates S3 bucket with lifecycle rules for chunks", () => {
    const template = createTestStack();

    template.hasResourceProperties("AWS::S3::Bucket", {
      LifecycleConfiguration: {
        Rules: Match.arrayWith([
          Match.objectLike({
            Prefix: "chunks/",
            ExpirationInDays: 7,
            Status: "Enabled",
          }),
        ]),
      },
    });
  });

  it("creates single DynamoDB table with PK/SK keys", () => {
    const template = createTestStack();

    template.hasResourceProperties("AWS::DynamoDB::Table", {
      TableName: "testapp-dev-table",
      KeySchema: [
        { AttributeName: "PK", KeyType: "HASH" },
        { AttributeName: "SK", KeyType: "RANGE" },
      ],
    });
  });

  it("creates DynamoDB table with GSI1 for access patterns", () => {
    const template = createTestStack();

    template.hasResourceProperties("AWS::DynamoDB::Table", {
      TableName: "testapp-dev-table",
      GlobalSecondaryIndexes: Match.arrayWith([
        Match.objectLike({
          IndexName: "GSI1",
          KeySchema: [
            { AttributeName: "GSI1PK", KeyType: "HASH" },
            { AttributeName: "GSI1SK", KeyType: "RANGE" },
          ],
        }),
      ]),
    });
  });

  it("creates DynamoDB table with TTL enabled", () => {
    const template = createTestStack();

    template.hasResourceProperties("AWS::DynamoDB::Table", {
      TableName: "testapp-dev-table",
      TimeToLiveSpecification: {
        AttributeName: "ttl",
        Enabled: true,
      },
    });
  });

  it("creates 1 DynamoDB table (single-table design)", () => {
    const template = createTestStack();
    template.resourceCountIs("AWS::DynamoDB::Table", 1);
  });
});

describe("MainStack - Auth", () => {
  it("creates Cognito User Pool with email sign-in", () => {
    const template = createTestStack();

    template.hasResourceProperties("AWS::Cognito::UserPool", {
      UsernameAttributes: ["email"],
      AutoVerifiedAttributes: ["email"],
    });
  });

  it("creates Cognito User Pool Client", () => {
    const template = createTestStack();

    template.hasResourceProperties("AWS::Cognito::UserPoolClient", {
      ClientName: "testapp-dev-web-client",
      GenerateSecret: false,
    });
  });
});

describe("MainStack - Lambda Functions", () => {
  it("creates Marp Lambda as Node.js ZIP Lambda with 3008MB memory", () => {
    const template = createTestStack();

    template.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "testapp-dev-marp-render",
      Runtime: "nodejs22.x",
      Handler: "index.handler",
      MemorySize: 3008,
      Timeout: 300,
    });
  });

  it("creates Marp Lambda with 2048MB ephemeral storage", () => {
    const template = createTestStack();

    template.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "testapp-dev-marp-render",
      EphemeralStorage: { Size: 2048 },
    });
  });

  it("creates Polly Worker Lambda with 512MB memory and 60s timeout", () => {
    const template = createTestStack();

    template.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "testapp-dev-polly-worker",
      MemorySize: 512,
      Timeout: 60,
    });
  });

  it("grants Polly Worker polly:SynthesizeSpeech permission", () => {
    const template = createTestStack();

    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: "polly:SynthesizeSpeech",
            Effect: "Allow",
            Resource: "*",
          }),
        ]),
      },
    });
  });

  it("creates Caption Worker Lambda with 512MB memory", () => {
    const template = createTestStack();

    template.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "testapp-dev-caption-worker",
      Runtime: "nodejs22.x",
      MemorySize: 512,
      Timeout: 120,
    });
  });

  it("creates Clip Worker Lambda with 10240MB memory and 4096MB ephemeral storage", () => {
    const template = createTestStack();

    template.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "testapp-dev-clip-worker",
      Runtime: "nodejs22.x",
      MemorySize: 10240,
      Timeout: 900,
      EphemeralStorage: { Size: 4096 },
    });
  });

  it("creates Concat Worker Lambda with 10240MB memory and 4096MB ephemeral storage", () => {
    const template = createTestStack();

    template.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "testapp-dev-concat-worker",
      Runtime: "nodejs22.x",
      MemorySize: 10240,
      Timeout: 900,
      EphemeralStorage: { Size: 4096 },
    });
  });

  it("creates Slide Generator Lambda with 1024MB memory", () => {
    const template = createTestStack();

    template.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "testapp-dev-slide-generator",
      MemorySize: 1024,
      Timeout: 120,
    });
  });
});

describe("MainStack - API Gateway", () => {
  it("creates REST API", () => {
    const template = createTestStack();

    template.hasResourceProperties("AWS::ApiGateway::RestApi", {
      Name: "testapp-dev-api",
    });
  });

  it("creates Cognito authorizer", () => {
    const template = createTestStack();

    template.hasResourceProperties("AWS::ApiGateway::Authorizer", {
      Type: "COGNITO_USER_POOLS",
      Name: "testapp-dev-cognito-authorizer",
    });
  });

  it("adds CORS headers to default, unauthorized, and access-denied responses", () => {
    const template = createTestStack();
    const corsResponseParameters = {
      "gatewayresponse.header.Access-Control-Allow-Origin": "'*'",
      "gatewayresponse.header.Access-Control-Allow-Headers":
        "'Content-Type,Authorization,X-Amz-Date,X-Api-Key,Idempotency-Key'",
      "gatewayresponse.header.Access-Control-Allow-Methods":
        "'GET,POST,PUT,DELETE,OPTIONS'",
    };

    template.resourceCountIs("AWS::ApiGateway::GatewayResponse", 4);
    for (const responseType of [
      "DEFAULT_4XX",
      "DEFAULT_5XX",
      "UNAUTHORIZED",
      "ACCESS_DENIED",
    ]) {
      template.hasResourceProperties("AWS::ApiGateway::GatewayResponse", {
        ResponseType: responseType,
        ResponseParameters: corsResponseParameters,
      });
    }
  });

  it("creates 13 protected API methods (section 5 endpoints)", () => {
    const template = createTestStack();
    const methods = Object.values(
      template.findResources("AWS::ApiGateway::Method"),
    );
    const protectedMethods = methods.filter(
      (method) => method.Properties.HttpMethod !== "OPTIONS",
    );

    // 13 protected methods: GET+POST /projects, POST+PUT /projects/{id}/outline,
    // POST /projects/{id}/deck, POST /projects/{id}/source-upload-url,
    // POST /projects/{id}/source, PUT /projects/{id}/output,
    // POST+PUT /projects/{id}/narration, POST /projects/{id}/renders,
    // GET /projects/{id}/renders/{renderId}, GET /projects/{id}/renders/{renderId}/artifacts
    expect(protectedMethods).toHaveLength(13);
  });

  it("creates OPTIONS preflight methods for CORS", () => {
    const template = createTestStack();
    const methods = Object.values(
      template.findResources("AWS::ApiGateway::Method"),
    );
    const preflightMethods = methods.filter(
      (method) => method.Properties.HttpMethod === "OPTIONS",
    );

    // OPTIONS on each resource path that has methods
    expect(preflightMethods.length).toBeGreaterThan(0);
  });

  it("uses Cognito for protected methods and no auth for CORS preflight", () => {
    const template = createTestStack();
    const methods = template.findResources("AWS::ApiGateway::Method");

    for (const [, method] of Object.entries(methods)) {
      if (method.Properties.HttpMethod === "OPTIONS") {
        expect(method.Properties.AuthorizationType).toBe("NONE");
        expect(method.Properties.Integration.Type).toBe("MOCK");
        continue;
      }

      expect(method.Properties.AuthorizationType).toBe("COGNITO_USER_POOLS");
    }
  });
});

describe("MainStack - Step Functions", () => {
  it("creates 5-stage Render Pipeline state machine", () => {
    const template = createTestStack();

    template.hasResourceProperties("AWS::StepFunctions::StateMachine", {
      StateMachineName: "testapp-dev-render-pipeline",
      StateMachineType: "STANDARD",
    });
  });

  it("creates exactly 1 state machine (render pipeline only, no content SM)", () => {
    const template = createTestStack();
    template.resourceCountIs("AWS::StepFunctions::StateMachine", 1);
  });

  it("render pipeline has Map states for parallel audio and clip processing", () => {
    const template = createTestStack();

    const stateMachines = template.findResources(
      "AWS::StepFunctions::StateMachine",
      {
        Properties: {
          StateMachineName: "testapp-dev-render-pipeline",
        },
      },
    );

    const smKeys = Object.keys(stateMachines);
    expect(smKeys.length).toBe(1);

    const definition =
      stateMachines[smKeys[0]].Properties.DefinitionString["Fn::Join"][1];
    const definitionStr = definition.join("");

    // Verify Map states exist for parallel processing
    expect(definitionStr).toContain("Map");
  });

  it("render pipeline includes all 5 stages: pages, audio, captions, clips, concat", () => {
    const template = createTestStack();

    const stateMachines = template.findResources(
      "AWS::StepFunctions::StateMachine",
      {
        Properties: {
          StateMachineName: "testapp-dev-render-pipeline",
        },
      },
    );

    const smKeys = Object.keys(stateMachines);
    const definition =
      stateMachines[smKeys[0]].Properties.DefinitionString["Fn::Join"][1];
    const definitionStr = definition.join("");

    expect(definitionStr).toContain("PagesStage");
    expect(definitionStr).toContain("AudioMapPages");
    expect(definitionStr).toContain("CaptionsStage");
    expect(definitionStr).toContain("ClipsMapPages");
    expect(definitionStr).toContain("ConcatStage");
  });
});

describe("MainStack - No Teaser Resources", () => {
  it("does not create any teaser-related state machines", () => {
    const template = createTestStack();

    const stateMachines = template.findResources(
      "AWS::StepFunctions::StateMachine",
    );

    for (const [, sm] of Object.entries(stateMachines)) {
      const name = sm.Properties.StateMachineName ?? "";
      expect(name).not.toContain("teaser");
    }
  });

  it("does not create any teaser Lambda functions", () => {
    const template = createTestStack();

    const functions = template.findResources("AWS::Lambda::Function");

    for (const [, fn] of Object.entries(functions)) {
      const name = fn.Properties.FunctionName ?? "";
      expect(name).not.toContain("teaser");
    }
  });

  it("does not create any SQS queues (no approval queue needed)", () => {
    const template = createTestStack();
    template.resourceCountIs("AWS::SQS::Queue", 0);
  });
});

describe("MainStack - CloudFront", () => {
  it("creates CloudFront distribution for content delivery", () => {
    const template = createTestStack();

    template.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: Match.objectLike({
        Comment: "testapp-dev content delivery",
        Enabled: true,
      }),
    });
  });

  it("creates CloudFront distribution for frontend", () => {
    const template = createTestStack();

    template.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: Match.objectLike({
        Comment: "testapp-dev frontend",
        Enabled: true,
      }),
    });
  });

  it("uses OAC for S3 access", () => {
    const template = createTestStack();

    template.resourceCountIs(
      "AWS::CloudFront::OriginAccessControl",
      2,
    );
  });
});

describe("MainStack - Frontend Hosting", () => {
  it("creates frontend S3 bucket", () => {
    const template = createTestStack();

    template.hasResourceProperties("AWS::S3::Bucket", {
      BucketName: "testapp-dev-frontend",
    });
  });

  it("creates frontend CloudFront with SPA error responses", () => {
    const template = createTestStack();

    template.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: Match.objectLike({
        Comment: "testapp-dev frontend",
        DefaultRootObject: "index.html",
        CustomErrorResponses: Match.arrayWith([
          Match.objectLike({
            ErrorCode: 403,
            ResponseCode: 200,
            ResponsePagePath: "/index.html",
          }),
          Match.objectLike({
            ErrorCode: 404,
            ResponseCode: 200,
            ResponsePagePath: "/index.html",
          }),
        ]),
      }),
    });
  });
});

describe("MainStack - Environment Variables", () => {
  it("API Lambda has TABLE_NAME env var", () => {
    const template = createTestStack();

    template.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "testapp-dev-api",
      Environment: {
        Variables: Match.objectLike({
          TABLE_NAME: Match.anyValue(),
        }),
      },
    });
  });

  it("API Lambda has BUCKET_NAME env var", () => {
    const template = createTestStack();

    template.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "testapp-dev-api",
      Environment: {
        Variables: Match.objectLike({
          BUCKET_NAME: Match.anyValue(),
        }),
      },
    });
  });

  it("API Lambda has RENDER_STATE_MACHINE_ARN env var", () => {
    const template = createTestStack();

    template.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "testapp-dev-api",
      Environment: {
        Variables: Match.objectLike({
          RENDER_STATE_MACHINE_ARN: Match.anyValue(),
        }),
      },
    });
  });

  it("API Lambda has SLIDE_GENERATOR_ARN env var", () => {
    const template = createTestStack();

    template.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "testapp-dev-api",
      Environment: {
        Variables: Match.objectLike({
          SLIDE_GENERATOR_ARN: Match.anyValue(),
        }),
      },
    });
  });

  it("API Lambda has MARP_LAMBDA_ARN env var", () => {
    const template = createTestStack();

    template.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "testapp-dev-api",
      Environment: {
        Variables: Match.objectLike({
          MARP_LAMBDA_ARN: Match.anyValue(),
        }),
      },
    });
  });

  it("Caption Worker has BUCKET_NAME env var", () => {
    const template = createTestStack();

    template.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "testapp-dev-caption-worker",
      Environment: {
        Variables: Match.objectLike({
          BUCKET_NAME: Match.anyValue(),
        }),
      },
    });
  });

  it("Clip Worker has BUCKET_NAME env var", () => {
    const template = createTestStack();

    template.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "testapp-dev-clip-worker",
      Environment: {
        Variables: Match.objectLike({
          BUCKET_NAME: Match.anyValue(),
        }),
      },
    });
  });

  it("Concat Worker has BUCKET_NAME env var", () => {
    const template = createTestStack();

    template.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "testapp-dev-concat-worker",
      Environment: {
        Variables: Match.objectLike({
          BUCKET_NAME: Match.anyValue(),
        }),
      },
    });
  });

  it("Polly Worker has BUCKET_NAME env var", () => {
    const template = createTestStack();

    template.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "testapp-dev-polly-worker",
      Environment: {
        Variables: Match.objectLike({
          BUCKET_NAME: Match.anyValue(),
        }),
      },
    });
  });
});
