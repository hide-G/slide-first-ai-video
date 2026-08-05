import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export interface MarpLambdaConstructProps {
  productSlug: string;
  environment: string;
  projectBucket: s3.Bucket;
}

/**
 * Marp Lambda construct: DockerImageFunction for Marp rendering.
 * Memory 3008MB, ephemeral storage 2048MB, timeout 5 min.
 */
export class MarpLambdaConstruct extends Construct {
  public readonly handler: lambda.DockerImageFunction;

  constructor(scope: Construct, id: string, props: MarpLambdaConstructProps) {
    super(scope, id);

    const { productSlug, environment } = props;

    this.handler = new lambda.DockerImageFunction(this, "MarpHandler", {
      functionName: `${productSlug}-${environment}-marp-render`,
      code: lambda.DockerImageCode.fromImageAsset("../lambdas/marp-render"),
      memorySize: 3008,
      ephemeralStorageSize: cdk.Size.mebibytes(2048),
      timeout: cdk.Duration.minutes(5),
      environment: {
        BUCKET_NAME: props.projectBucket.bucketName,
      },
    });

    // Grant S3 read/write to all keys (actual keys are userId/projectId/versions/vNNNN/slides/...)
    props.projectBucket.grantReadWrite(this.handler, "*");
  }
}
