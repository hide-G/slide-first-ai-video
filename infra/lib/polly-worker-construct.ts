import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export interface PollyWorkerConstructProps {
  productSlug: string;
  environment: string;
  projectBucket: s3.Bucket;
}

/**
 * Polly Worker construct: Lambda function for speech synthesis.
 * Memory 512MB, timeout 60s. IAM: polly:SynthesizeSpeech, S3 write to audio/ prefix.
 */
export class PollyWorkerConstruct extends Construct {
  public readonly handler: lambda.Function;

  constructor(scope: Construct, id: string, props: PollyWorkerConstructProps) {
    super(scope, id);

    const { productSlug, environment } = props;

    this.handler = new lambda.Function(this, "PollyWorkerHandler", {
      functionName: `${productSlug}-${environment}-polly-worker`,
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("../lambdas/polly-worker/dist"),
      memorySize: 512,
      timeout: cdk.Duration.seconds(60),
      environment: {
        PROJECT_BUCKET: props.projectBucket.bucketName,
      },
    });

    // Grant polly:SynthesizeSpeech
    this.handler.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["polly:SynthesizeSpeech"],
        resources: ["*"],
      }),
    );

    // Grant S3 write to audio/ prefix
    props.projectBucket.grantWrite(this.handler, "audio/*");
    // Grant S3 read for input text
    props.projectBucket.grantRead(this.handler);
  }
}
