import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export interface ConcatWorkerConstructProps {
  productSlug: string;
  environment: string;
  projectBucket: s3.Bucket;
}

/**
 * Concat Worker Lambda construct.
 * Concatenates all page clips into the final video.
 * Memory 10240MB, ephemeral storage 4096MB, timeout 15 min.
 */
export class ConcatWorkerConstruct extends Construct {
  public readonly handler: lambda.Function;

  constructor(scope: Construct, id: string, props: ConcatWorkerConstructProps) {
    super(scope, id);

    const { productSlug, environment } = props;

    this.handler = new lambda.Function(this, "ConcatWorkerHandler", {
      functionName: `${productSlug}-${environment}-concat-worker`,
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("../lambdas/concat-worker/dist"),
      memorySize: 10240,
      ephemeralStorageSize: cdk.Size.mebibytes(4096),
      timeout: cdk.Duration.minutes(15),
      environment: {
        BUCKET_NAME: props.projectBucket.bucketName,
      },
    });

    props.projectBucket.grantReadWrite(this.handler);
  }
}
