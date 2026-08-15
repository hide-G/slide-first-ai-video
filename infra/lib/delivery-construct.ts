import * as cdk from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";

export interface DeliveryConstructProps {
  productSlug: string;
  environment: string;
  projectBucket: s3.Bucket;
}

/**
 * Delivery コンストラクト:
 * - フロントエンド用S3バケット + CloudFront配信
 * - 成果物配信 (projectBucket/output) も同じDistributionの /api-assets パスで配信
 */
export class DeliveryConstruct extends Construct {
  public readonly distribution: cloudfront.Distribution;
  public readonly frontendBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: DeliveryConstructProps) {
    super(scope, id);

    const { productSlug, environment } = props;

    // フロントエンド配信用S3バケット
    this.frontendBucket = new s3.Bucket(this, "FrontendBucket", {
      bucketName: `${productSlug}-frontend-${environment}-${cdk.Aws.ACCOUNT_ID}-${cdk.Aws.REGION}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // CloudFront ディストリビューション
    this.distribution = new cloudfront.Distribution(this, "Distribution", {
      comment: `${productSlug}-${environment} web app`,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(
          this.frontendBucket,
        ),
        viewerProtocolPolicy:
          cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
      },
      // SPA対応: 404時にindex.htmlへフォールバック
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: cdk.Duration.seconds(0),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: cdk.Duration.seconds(0),
        },
      ],
      // 成果物配信用の追加ビヘイビア
      additionalBehaviors: {
        "/assets/*": {
          origin: origins.S3BucketOrigin.withOriginAccessControl(
            props.projectBucket,
            { originPath: "/output" },
          ),
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        },
      },
      defaultRootObject: "index.html",
      enabled: true,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
    });

    // フロントエンドのビルド成果物をS3にデプロイ
    new s3deploy.BucketDeployment(this, "DeployFrontend", {
      sources: [s3deploy.Source.asset("../packages/frontend/dist")],
      destinationBucket: this.frontendBucket,
      distribution: this.distribution,
      distributionPaths: ["/*"],
    });

    // CloudFront URL を出力
    new cdk.CfnOutput(scope, "FrontendUrl", {
      value: `https://${this.distribution.distributionDomainName}`,
      description: "フロントエンドURL",
    });
  }
}
