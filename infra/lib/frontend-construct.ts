import * as cdk from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export interface FrontendConstructProps {
  productSlug: string;
  environment: string;
}

/**
 * Frontend construct: S3 bucket for SPA hosting + CloudFront distribution.
 * Hosts the React frontend application with SPA routing support.
 */
export class FrontendConstruct extends Construct {
  public readonly bucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: FrontendConstructProps) {
    super(scope, id);

    const { productSlug, environment } = props;

    // S3 bucket for SPA static assets
    this.bucket = new s3.Bucket(this, "FrontendBucket", {
      bucketName: `${productSlug}-${environment}-frontend`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // CloudFront distribution for SPA
    this.distribution = new cloudfront.Distribution(this, "Distribution", {
      comment: `${productSlug}-${environment} frontend`,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.bucket),
        viewerProtocolPolicy:
          cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
      },
      defaultRootObject: "index.html",
      // SPA routing: return index.html for 403/404 errors (client-side routing)
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: cdk.Duration.minutes(5),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: cdk.Duration.minutes(5),
        },
      ],
      enabled: true,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
    });

    // Output the distribution domain name
    new cdk.CfnOutput(this, "FrontendUrl", {
      value: `https://${this.distribution.distributionDomainName}`,
      description: "Frontend application URL",
    });
  }
}
