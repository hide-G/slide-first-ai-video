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

export interface SlideGeneratorConstructProps {
  productSlug: string;
  environment: string;
  projectBucket: s3.Bucket;
}

/**
 * Bedrock Converse APIでスライドを生成するConstruct。
 * メモリ1024MiB、タイムアウト120秒、Bedrock呼び出しとS3の読み書きを許可する。
 */
export class SlideGeneratorConstruct extends Construct {
  public readonly handler: lambda.Function;

  constructor(
    scope: Construct,
    id: string,
    props: SlideGeneratorConstructProps,
  ) {
    super(scope, id);

    const { productSlug, environment } = props;
    const repositoryRoot = findRepositoryRoot(
      path.dirname(fileURLToPath(import.meta.url)),
    );

    // ローカルesbuildでworkspace依存とAWS SDKをバンドルする。
    this.handler = new lambdaNodejs.NodejsFunction(
      this,
      "SlideGeneratorHandler",
      {
        functionName: `${productSlug}-${environment}-slide-generator`,
        runtime: lambda.Runtime.NODEJS_22_X,
        entry: path.join(
          repositoryRoot,
          "lambdas",
          "slide-generator",
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
      },
    );

    // 既存どおり、Bedrockモデル呼び出しを許可する。
    this.handler.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["bedrock:InvokeModel"],
        resources: ["*"],
      }),
    );

    // 参照データの読み取りとdeck.mdの書き込みを許可する。
    props.projectBucket.grantReadWrite(this.handler);
  }
}
