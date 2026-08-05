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
        PROJECT_BUCKET: props.projectBucket.bucketName,
      },
    });

    // Grant S3 write to slides/ and versions/ prefixes
    props.projectBucket.grantWrite(this.handler, "slides/*");
    props.projectBucket.grantWrite(this.handler, "versions/*");
    // Also grant read for input markdown
    props.projectBucket.grantRead(this.handler);
  }
}
