import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { StorageConstruct } from "../lib/storage-construct.js";
import { AuthConstruct } from "../lib/auth-construct.js";
import { MarpLambdaConstruct } from "../lib/marp-lambda-construct.js";
import { PollyWorkerConstruct } from "../lib/polly-worker-construct.js";
import { SlideGeneratorConstruct } from "../lib/slide-generator-construct.js";
import { CaptionWorkerConstruct } from "../lib/caption-worker-construct.js";
import { MediaConvertWorkerConstruct } from "../lib/mediaconvert-worker-construct.js";
import { RenderStateMachineConstruct } from "../lib/render-state-machine-construct.js";
import { ApiConstruct } from "../lib/api-construct.js";
import { DeliveryConstruct } from "../lib/delivery-construct.js";
import { FrontendConstruct } from "../lib/frontend-construct.js";

export interface MainStackProps extends cdk.StackProps {
  productSlug: string;
  envName: string;
}

/**
 * Main CDK stack for the slide-first AI video application.
 * Composes all infrastructure constructs for the 5-stage render pipeline.
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

    // Marp Lambda: Node.js Lambda for page rendering
    const marpLambda = new MarpLambdaConstruct(this, "MarpLambda", {
      productSlug: props.productSlug,
      environment: props.envName,
      projectBucket: storage.projectBucket,
    });

    // Polly Worker Lambda: TTS audio generation
    const pollyWorker = new PollyWorkerConstruct(this, "PollyWorker", {
      productSlug: props.productSlug,
      environment: props.envName,
      projectBucket: storage.projectBucket,
    });

    // Slide Generator Lambda: Bedrock Converse API for outline + narration
    const slideGenerator = new SlideGeneratorConstruct(
      this,
      "SlideGenerator",
      {
        productSlug: props.productSlug,
        environment: props.envName,
        projectBucket: storage.projectBucket,
      },
    );

    // Caption Worker Lambda: SRT generation
    const captionWorker = new CaptionWorkerConstruct(this, "CaptionWorker", {
      productSlug: props.productSlug,
      environment: props.envName,
      projectBucket: storage.projectBucket,
    });

    // MediaConvert Worker Lambda: Video rendering via AWS MediaConvert
    const mediaconvertWorker = new MediaConvertWorkerConstruct(
      this,
      "MediaConvertWorker",
      {
        productSlug: props.productSlug,
        environment: props.envName,
        projectBucket: storage.projectBucket,
      },
    );

    // 4-stage Render Pipeline State Machine (pages -> audio -> captions -> video)
    const renderStateMachine = new RenderStateMachineConstruct(
      this,
      "RenderSM",
      {
        productSlug: props.productSlug,
        environment: props.envName,
        projectBucket: storage.projectBucket,
        marpLambda: marpLambda.handler,
        pollyWorkerLambda: pollyWorker.handler,
        captionWorkerLambda: captionWorker.handler,
        mediaconvertWorkerLambda: mediaconvertWorker.handler,
      },
    );

    // API: API Gateway with Cognito authorizer and Lambda
    const api = new ApiConstruct(this, "Api", {
      productSlug: props.productSlug,
      environment: props.envName,
      userPool: auth.userPool,
      table: storage.table,
      projectBucket: storage.projectBucket,
      renderStateMachine: renderStateMachine.stateMachine,
      slideGeneratorLambda: slideGenerator.handler,
      marpLambda: marpLambda.handler,
    });

    // Delivery: CloudFront distribution for content
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
