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
 * Marp Lambda コンストラクト: Node.js Lambda で Marp レンダリングを実行。
 * @sparticuz/chromium を使用し、Docker 不要。
 * メモリ 3008MB、エフェメラルストレージ 2048MB、タイムアウト 5分。
 */
export class MarpLambdaConstruct extends Construct {
  public readonly handler: lambda.Function;

  constructor(scope: Construct, id: string, props: MarpLambdaConstructProps) {
    super(scope, id);

    const { productSlug, environment } = props;

    this.handler = new lambda.Function(this, "MarpHandler", {
      functionName: `${productSlug}-${environment}-marp-render`,
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("../lambdas/marp-render/dist"),
      memorySize: 3008,
      ephemeralStorageSize: cdk.Size.mebibytes(2048),
      timeout: cdk.Duration.minutes(5),
      environment: {
        BUCKET_NAME: props.projectBucket.bucketName,
      },
    });

    // S3 読み書き権限を付与
    props.projectBucket.grantReadWrite(this.handler, "*");
  }
}
