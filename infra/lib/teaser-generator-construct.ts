import { existsSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

function findRepositoryRoot(startDirectory: string): string {
  let directory = startDirectory;

  while (true) {
    if (existsSync(path.join(directory, "pnpm-lock.yaml"))) {
      return directory;
    }

    const parentDirectory = path.dirname(directory);
    if (parentDirectory === directory) {
      throw new Error("pnpm-lock.yamlを含むリポジトリルートを特定できませんでした。");
    }

    directory = parentDirectory;
  }
}

export interface TeaserGeneratorConstructProps {
  productSlug: string;
  environment: string;
  projectBucket: s3.Bucket;
}

/**
 * Bedrockでティーザーを生成するConstruct。
 * メモリ1024MiB、タイムアウト120秒、Bedrock呼び出しとS3読み取りを許可する。
 */
export class TeaserGeneratorConstruct extends Construct {
  public readonly handler: lambda.Function;

  constructor(
    scope: Construct,
    id: string,
    props: TeaserGeneratorConstructProps,
  ) {
    super(scope, id);

    const { productSlug, environment } = props;
    const repositoryRoot = findRepositoryRoot(
      path.dirname(fileURLToPath(import.meta.url)),
    );

    // ローカルesbuildでworkspace依存とAWS SDKをバンドルする。
    this.handler = new lambdaNodejs.NodejsFunction(this, "TeaserGeneratorHandler", {
      functionName: `${productSlug}-${environment}-teaser-generator`,
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(
        repositoryRoot,
        "lambdas",
        "teaser-generator",
        "src",
        "index.ts",
      ),
      handler: "handler",
      depsLockFilePath: path.join(repositoryRoot, "pnpm-lock.yaml"),
      projectRoot: repositoryRoot,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(120),
      environment: {
        BUCKET_NAME: props.projectBucket.bucketName,
        BEDROCK_MODEL_ID: "anthropic.claude-sonnet-4-20250514",
      },
      bundling: {
        bundleAwsSDK: true,
        externalModules: [],
        forceDockerBundling: false,
        format: lambdaNodejs.OutputFormat.CJS,
        minify: false,
        sourceMap: false,
        target: "node22",
      },
    });

    // Bedrockモデル呼び出しを対象モデルだけに限定する。
    const modelId = "anthropic.claude-sonnet-4-20250514";
    this.handler.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["bedrock:InvokeModel"],
        resources: [
          `arn:aws:bedrock:*::foundation-model/${modelId}`,
        ],
      }),
    );

    // マニフェストとスライドデータの読み取りを許可する。
    props.projectBucket.grantRead(this.handler);
  }
}
