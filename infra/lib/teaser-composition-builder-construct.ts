import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export interface TeaserCompositionBuilderConstructProps {
  productSlug: string;
  environment: string;
  projectBucket: s3.Bucket;
}

/**
 * Teaser Composition Builder construct: Lambda function that generates
 * Hyperframes HTML for teaser videos (16:9 and 9:16 layouts).
 * Memory 512MB, timeout 60s. IAM: S3 read/write.
 */
export class TeaserCompositionBuilderConstruct extends Construct {
  public readonly handler: lambda.Function;

  constructor(
    scope: Construct,
    id: string,
    props: TeaserCompositionBuilderConstructProps,
  ) {
    super(scope, id);

    const { productSlug, environment } = props;

    this.handler = new lambda.Function(
      this,
      "TeaserCompositionBuilderHandler",
      {
        functionName: `${productSlug}-${environment}-teaser-composition-builder`,
        runtime: lambda.Runtime.NODEJS_22_X,
        handler: "index.handler",
        code: lambda.Code.fromAsset(
          "../lambdas/teaser-composition-builder/dist",
        ),
        memorySize: 512,
        timeout: cdk.Duration.seconds(60),
        environment: {
          BUCKET_NAME: props.projectBucket.bucketName,
        },
      },
    );

    // Grant S3 read/write for reading assets and writing composition HTML
    props.projectBucket.grantReadWrite(this.handler);
  }
}
