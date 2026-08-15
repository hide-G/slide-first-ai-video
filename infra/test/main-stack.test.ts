import { describe, it, expect } from "vitest";
import * as cdk from "aws-cdk-lib";
import { Template, Match } from "aws-cdk-lib/assertions";
import { MainStack } from "../src/main-stack.js";

function createTestStack(): Template {
  const app = new cdk.App();
  const stack = new MainStack(app, "TestStack", {
    productSlug: "testapp",
    envName: "dev",
    env: {
      account: "123456789012",
      region: "us-east-1",
    },
  });
  return Template.fromStack(stack);
}

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
  it("creates Marp Lambda as DockerImageFunction with 3008MB memory", () => {
    const template = createTestStack();

    template.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "testapp-dev-marp-render",
      MemorySize: 3008,
      Timeout: 300,
      PackageType: "Image",
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

  it("creates Composition Builder Lambda with 512MB memory and 60s timeout", () => {
    const template = createTestStack();

    template.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "testapp-dev-composition-builder",
      MemorySize: 512,
      Timeout: 60,
    });
  });

  it("creates Render Lambda with 10240MB memory and 4096MB ephemeral storage", () => {
    const template = createTestStack();

    template.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "testapp-dev-renderer",
      MemorySize: 10240,
      Timeout: 900,
      EphemeralStorage: { Size: 4096 },
    });
  });

  it("creates Teaser Generator Lambda with 1024MB memory", () => {
    const template = createTestStack();

    template.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "testapp-dev-teaser-generator",
      MemorySize: 1024,
      Timeout: 120,
    });
  });

  it("creates Teaser Composition Builder Lambda with 512MB memory", () => {
    const template = createTestStack();

    template.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "testapp-dev-teaser-composition-builder",
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

  it("creates 9 API methods", () => {
    const template = createTestStack();
    // 9 routes: GET /projects, POST /projects, POST /projects/{id}/slides,
    // GET /projects/{id}/versions/{version}, POST /projects/{id}/versions/{version}/approve,
    // POST /projects/{id}/videos, POST /projects/{id}/videos/teaser,
    // GET /projects/{id}/deliverables, GET /jobs/{jobId}
    template.resourceCountIs("AWS::ApiGateway::Method", 9);
  });

  it("all methods use Cognito authorization", () => {
    const template = createTestStack();
    const methods = template.findResources("AWS::ApiGateway::Method");

    for (const [, method] of Object.entries(methods)) {
      expect(method.Properties.AuthorizationType).toBe("COGNITO_USER_POOLS");
    }
  });
});

describe("MainStack - Step Functions", () => {
  it("creates Content Generation state machine", () => {
    const template = createTestStack();

    template.hasResourceProperties("AWS::StepFunctions::StateMachine", {
      StateMachineName: "testapp-dev-content-generation",
      StateMachineType: "STANDARD",
    });
  });

  it("creates Render Pipeline state machine", () => {
    const template = createTestStack();

    template.hasResourceProperties("AWS::StepFunctions::StateMachine", {
      StateMachineName: "testapp-dev-render-pipeline",
      StateMachineType: "STANDARD",
    });
  });

  it("creates 3 state machines total", () => {
    const template = createTestStack();
    template.resourceCountIs("AWS::StepFunctions::StateMachine", 3);
  });

  it("content state machine has Parallel state for Marp + Polly", () => {
    const template = createTestStack();

    // Find the content state machine and verify its definition includes a Parallel state
    const stateMachines = template.findResources(
      "AWS::StepFunctions::StateMachine",
      {
        Properties: {
          StateMachineName: "testapp-dev-content-generation",
        },
      },
    );

    const smKeys = Object.keys(stateMachines);
    expect(smKeys.length).toBe(1);

    const definition =
      stateMachines[smKeys[0]].Properties.DefinitionString["Fn::Join"][1];
    const definitionStr = definition.join("");

    // Verify a Parallel state exists in the definition
    expect(definitionStr).toContain("Parallel");
  });

  it("content state machine has callback-token approval step", () => {
    const template = createTestStack();

    const stateMachines = template.findResources(
      "AWS::StepFunctions::StateMachine",
      {
        Properties: {
          StateMachineName: "testapp-dev-content-generation",
        },
      },
    );

    const smKeys = Object.keys(stateMachines);
    expect(smKeys.length).toBe(1);

    const definition =
      stateMachines[smKeys[0]].Properties.DefinitionString["Fn::Join"][1];
    const definitionStr = definition.join("");

    // Verify the approval step uses waitForTaskToken pattern (SQS send)
    expect(definitionStr).toContain("WaitForApproval");
    expect(definitionStr).toContain(".waitForTaskToken");
  });

  it("creates Teaser Pipeline state machine", () => {
    const template = createTestStack();

    template.hasResourceProperties("AWS::StepFunctions::StateMachine", {
      StateMachineName: "testapp-dev-teaser-pipeline",
      StateMachineType: "STANDARD",
    });
  });

  it("render state machine has Map state for parallel chunk rendering", () => {
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

    // Verify a Map state exists in the definition
    expect(definitionStr).toContain("Map");
  });
});

describe("MainStack - SQS", () => {
  it("creates approval queue for callback token pattern", () => {
    const template = createTestStack();

    template.hasResourceProperties("AWS::SQS::Queue", {
      QueueName: "testapp-dev-approval-queue",
    });
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

  it("API Lambda has VIDEO_STATE_MACHINE_ARN env var", () => {
    const template = createTestStack();

    template.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "testapp-dev-api",
      Environment: {
        Variables: Match.objectLike({
          VIDEO_STATE_MACHINE_ARN: Match.anyValue(),
        }),
      },
    });
  });

  it("API Lambda has TEASER_STATE_MACHINE_ARN env var", () => {
    const template = createTestStack();

    template.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "testapp-dev-api",
      Environment: {
        Variables: Match.objectLike({
          TEASER_STATE_MACHINE_ARN: Match.anyValue(),
        }),
      },
    });
  });

  it("Render Lambda has BUCKET_NAME env var", () => {
    const template = createTestStack();

    template.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "testapp-dev-renderer",
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
