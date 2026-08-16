import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { StorageConstruct } from "../lib/storage-construct.js";
import { AuthConstruct } from "../lib/auth-construct.js";
import { MarpLambdaConstruct } from "../lib/marp-lambda-construct.js";
import { PollyWorkerConstruct } from "../lib/polly-worker-construct.js";
import { SlideGeneratorConstruct } from "../lib/slide-generator-construct.js";
import { RenderStateMachineConstruct } from "../lib/render-state-machine-construct.js";
import { ContentStateMachineConstruct } from "../lib/content-state-machine-construct.js";
import { ApiConstruct } from "../lib/api-construct.js";
import { DeliveryConstruct } from "../lib/delivery-construct.js";
import { FrontendConstruct } from "../lib/frontend-construct.js";

export interface MainStackProps extends cdk.StackProps {
  productSlug: string;
  envName: string;
}

/**
 * Main CDK stack for the slide-first AI video application.
 * Composes all infrastructure constructs.
 */
export class MainStack extends cdk.Stack {
  public readonly productSlug: string;
  public readonly envName: string;

  constructor(scope: Construct, id: string, props: MainStackProps) {
    super(scope, id, props);

    this.productSlug = props.productSlug;
    this.envName = props.envName;

    // Tag all resources with product slug and environment
    cdk.Tags.of(this).add("Product", props.productSlug);
    cdk.Tags.of(this).add("Environment", props.envName);

    // Storage: S3 bucket and DynamoDB single table
    const storage = new StorageConstruct(this, "Storage", {
      productSlug: props.productSlug,
      environment: props.envName,
    });

    // Auth: Cognito User Pool
    const auth = new AuthConstruct(this, "Auth", {
      productSlug: props.productSlug,
      environment: props.envName,
    });

    // Marp Lambda: DockerImageFunction for rendering
    const marpLambda = new MarpLambdaConstruct(this, "MarpLambda", {
      productSlug: props.productSlug,
      environment: props.envName,
      projectBucket: storage.projectBucket,
    });

    // Polly Worker Lambda
    const pollyWorker = new PollyWorkerConstruct(this, "PollyWorker", {
      productSlug: props.productSlug,
      environment: props.envName,
      projectBucket: storage.projectBucket,
    });

    // Slide Generator Lambda (Bedrock Converse API)
    const slideGenerator = new SlideGeneratorConstruct(
      this,
      "SlideGenerator",
      {
        productSlug: props.productSlug,
        environment: props.envName,
        projectBucket: storage.projectBucket,
      },
    );

    // Render State Machine (must be created before Content SM)
    const renderStateMachine = new RenderStateMachineConstruct(
      this,
      "RenderSM",
      {
        productSlug: props.productSlug,
        environment: props.envName,
        projectBucket: storage.projectBucket,
      },
    );

    // Content State Machine
    const contentStateMachine = new ContentStateMachineConstruct(
      this,
      "ContentSM",
      {
        productSlug: props.productSlug,
        environment: props.envName,
        slideGeneratorLambda: slideGenerator.handler,
        marpLambda: marpLambda.handler,
        pollyWorkerLambda: pollyWorker.handler,
        renderStateMachine: renderStateMachine.stateMachine,
        table: storage.table,
      },
    );

    // API: API Gateway with Cognito authorizer and Lambda
    const api = new ApiConstruct(this, "Api", {
      productSlug: props.productSlug,
      environment: props.envName,
      userPool: auth.userPool,
      table: storage.table,
      projectBucket: storage.projectBucket,
      contentStateMachine: contentStateMachine.stateMachine,
      renderStateMachine: renderStateMachine.stateMachine,
      teaserStateMachine: renderStateMachine.stateMachine, // placeholder
      approvalQueue: contentStateMachine.approvalQueue,
    });

    // Delivery: CloudFront distribution
    new DeliveryConstruct(this, "Delivery", {
      productSlug: props.productSlug,
      environment: props.envName,
      projectBucket: storage.projectBucket,
    });

    // Frontend: S3 + CloudFront SPA hosting
    new FrontendConstruct(this, "Frontend", {
      productSlug: props.productSlug,
      environment: props.envName,
      apiEndpoint: cdk.Fn.join("", [
        "https://",
        api.api.restApiId,
        ".execute-api.",
        cdk.Aws.REGION,
        ".",
        cdk.Aws.URL_SUFFIX,
      ]),
      cognitoUserPoolId: auth.userPool.userPoolId,
      cognitoUserPoolClientId: auth.userPoolClient.userPoolClientId,
    });
  }
}
