import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export interface CaptionWorkerConstructProps {
  productSlug: string;
  environment: string;
  projectBucket: s3.Bucket;
}

/**
 * Caption Worker Lambda construct.
 * Generates SRT captions from audio timing data.
 * Memory 512MB, timeout 120s.
 */
export class CaptionWorkerConstruct extends Construct {
  public readonly handler: lambda.Function;

  constructor(scope: Construct, id: string, props: CaptionWorkerConstructProps) {
    super(scope, id);

    const { productSlug, environment } = props;

    this.handler = new lambda.Function(this, "CaptionWorkerHandler", {
      functionName: `${productSlug}-${environment}-caption-worker`,
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("../lambdas/caption-worker/dist"),
      memorySize: 512,
      timeout: cdk.Duration.seconds(120),
      environment: {
        BUCKET_NAME: props.projectBucket.bucketName,
      },
    });

    props.projectBucket.grantReadWrite(this.handler);
  }
}
