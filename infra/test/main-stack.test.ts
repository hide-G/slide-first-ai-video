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

  it("creates Projects DynamoDB table with correct keys", () => {
    const template = createTestStack();

    template.hasResourceProperties("AWS::DynamoDB::Table", {
      TableName: "testapp-dev-projects",
      KeySchema: [
        { AttributeName: "userId", KeyType: "HASH" },
        { AttributeName: "projectId", KeyType: "RANGE" },
      ],
    });
  });

  it("creates Versions DynamoDB table with correct keys", () => {
    const template = createTestStack();

    template.hasResourceProperties("AWS::DynamoDB::Table", {
      TableName: "testapp-dev-versions",
      KeySchema: [
        { AttributeName: "projectId", KeyType: "HASH" },
        { AttributeName: "version", KeyType: "RANGE" },
      ],
    });
  });

  it("creates Jobs DynamoDB table with correct key", () => {
    const template = createTestStack();

    template.hasResourceProperties("AWS::DynamoDB::Table", {
      TableName: "testapp-dev-jobs",
      KeySchema: [{ AttributeName: "jobId", KeyType: "HASH" }],
    });
  });

  it("creates Idempotency DynamoDB table with TTL", () => {
    const template = createTestStack();

    template.hasResourceProperties("AWS::DynamoDB::Table", {
      TableName: "testapp-dev-idempotency",
      KeySchema: [{ AttributeName: "idempotencyKey", KeyType: "HASH" }],
      TimeToLiveSpecification: {
        AttributeName: "ttl",
        Enabled: true,
      },
    });
  });

  it("creates 4 DynamoDB tables total", () => {
    const template = createTestStack();
    template.resourceCountIs("AWS::DynamoDB::Table", 4);
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

  it("creates 7 API methods", () => {
    const template = createTestStack();
    // 7 routes: POST /projects, POST /projects/{id}/slides,
    // GET /projects/{id}/versions/{version}, POST /projects/{id}/versions/{version}/approve,
    // POST /projects/{id}/videos, GET /projects/{id}/deliverables, GET /jobs/{jobId}
    template.resourceCountIs("AWS::ApiGateway::Method", 7);
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

  it("creates 2 state machines total", () => {
    const template = createTestStack();
    template.resourceCountIs("AWS::StepFunctions::StateMachine", 2);
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

describe("MainStack - CloudFront", () => {
  it("creates CloudFront distribution", () => {
    const template = createTestStack();

    template.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: Match.objectLike({
        Comment: "testapp-dev content delivery",
        Enabled: true,
      }),
    });
  });

  it("uses OAC for S3 access", () => {
    const template = createTestStack();

    template.resourceCountIs(
      "AWS::CloudFront::OriginAccessControl",
      1,
    );
  });
});
