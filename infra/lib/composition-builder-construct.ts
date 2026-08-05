import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export interface CompositionBuilderConstructProps {
  productSlug: string;
  environment: string;
  projectBucket: s3.Bucket;
}

/**
 * Composition Builder construct: Lambda function for building compositions.
 * Memory 512MB, timeout 60s. IAM: S3 read (manifest, images) and write (composition HTML).
 */
export class CompositionBuilderConstruct extends Construct {
  public readonly handler: lambda.Function;

  constructor(
    scope: Construct,
    id: string,
    props: CompositionBuilderConstructProps,
  ) {
    super(scope, id);

    const { productSlug, environment } = props;

    this.handler = new lambda.Function(this, "CompositionBuilderHandler", {
      functionName: `${productSlug}-${environment}-composition-builder`,
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("../lambdas/composition-builder/dist"),
      memorySize: 512,
      timeout: cdk.Duration.seconds(60),
      environment: {
        BUCKET_NAME: props.projectBucket.bucketName,
      },
    });

    // Grant S3 read and write on project bucket
    props.projectBucket.grantReadWrite(this.handler);
  }
}
