import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export interface DeliveryConstructProps {
  productSlug: string;
  environment: string;
  projectBucket: s3.Bucket;
}

/**
 * Delivery construct: CloudFront distribution with OAC for S3 origin.
 * Serves content from the output/ prefix of the project bucket.
 */
export class DeliveryConstruct extends Construct {
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: DeliveryConstructProps) {
    super(scope, id);

    const { productSlug, environment } = props;

    // CloudFront distribution with OAC (Origin Access Control) for S3
    this.distribution = new cloudfront.Distribution(this, "Distribution", {
      comment: `${productSlug}-${environment} content delivery`,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(
          props.projectBucket,
          {
            originPath: "/output",
          },
        ),
        viewerProtocolPolicy:
          cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
      },
      enabled: true,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
    });
  }
}
