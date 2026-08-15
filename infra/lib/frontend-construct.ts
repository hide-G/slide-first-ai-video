import * as cdk from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";

export interface FrontendConstructProps {
  productSlug: string;
  environment: string;
  apiEndpoint: string;
  cognitoUserPoolId: string;
  cognitoUserPoolClientId: string;
}

/**
 * フロントエンド構成: SPAホスティング用のS3バケットとCloudFrontディストリビューション。
 * クライアント側ルーティングを備えたReactフロントエンドを配信する。
 */
export class FrontendConstruct extends Construct {
  public readonly bucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: FrontendConstructProps) {
    super(scope, id);

    const {
      productSlug,
      environment,
      apiEndpoint,
      cognitoUserPoolId,
      cognitoUserPoolClientId,
    } = props;

    // SPA静的アセット用のS3バケット
    this.bucket = new s3.Bucket(this, "FrontendBucket", {
      bucketName: `${productSlug}-${environment}-frontend`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // SPA用のCloudFrontディストリビューション
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
      // クライアント側ルーティングのため、403/404ではindex.htmlを返す。
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

    // CloudFrontドメイン名を出力する。
    new cdk.CfnOutput(this, "FrontendUrl", {
      value: `https://${this.distribution.distributionDomainName}`,
      description: "Frontend application URL",
    });

    // フロントエンドのビルド成果物と、ブラウザ公開可能な接続設定をS3に配布する。
    // source mapはデバッグ用のため、アセット作成時に除外する。
    new s3deploy.BucketDeployment(this, "DeployFrontend", {
      sources: [
        s3deploy.Source.asset("../frontend/dist", {
          exclude: ["*.map", "**/*.map"],
        }),
        // パスワード、トークン、Client Secretは絶対に含めない。
        s3deploy.Source.jsonData("runtime-config.json", {
          apiEndpoint,
          cognitoUserPoolId,
          cognitoUserPoolClientId,
        }),
      ],
      destinationBucket: this.bucket,
      distribution: this.distribution,
      distributionPaths: ["/*"],
      memoryLimit: 512,
    });
  }
}
