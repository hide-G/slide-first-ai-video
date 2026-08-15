import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export interface TeaserGeneratorConstructProps {
  productSlug: string;
  environment: string;
  projectBucket: s3.Bucket;
}

/**
 * Teaser Generator construct: Lambda function for Bedrock-based teaser generation.
 * Selects important slides, generates hook text and post text.
 * Memory 1024MB, timeout 120s. IAM: bedrock:InvokeModel, S3 read.
 */
export class TeaserGeneratorConstruct extends Construct {
  public readonly handler: lambda.Function;

  constructor(
    scope: Construct,
    id: string,
    props: TeaserGeneratorConstructProps,
  ) {
    super(scope, id);

    const { productSlug, environment } = props;

    this.handler = new lambda.Function(this, "TeaserGeneratorHandler", {
      functionName: `${productSlug}-${environment}-teaser-generator`,
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("../lambdas/teaser-generator/dist"),
      memorySize: 1024,
      timeout: cdk.Duration.seconds(120),
      environment: {
        BUCKET_NAME: props.projectBucket.bucketName,
        BEDROCK_MODEL_ID: "anthropic.claude-sonnet-4-20250514",
      },
    });

    // Grant Bedrock invoke model permission
    this.handler.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["bedrock:InvokeModel"],
        resources: ["*"],
      }),
    );

    // Grant S3 read access for reading manifest and slide data
    props.projectBucket.grantRead(this.handler);
  }
}
