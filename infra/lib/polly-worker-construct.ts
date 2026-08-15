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

export interface PollyWorkerConstructProps {
  productSlug: string;
  environment: string;
  projectBucket: s3.Bucket;
}

/**
 * 音声合成を行うPolly Worker Construct。
 * メモリ512MiB、タイムアウト60秒、Pollyの音声合成とS3入出力を許可する。
 */
export class PollyWorkerConstruct extends Construct {
  public readonly handler: lambda.Function;

  constructor(scope: Construct, id: string, props: PollyWorkerConstructProps) {
    super(scope, id);

    const { productSlug, environment } = props;
    const repositoryRoot = findRepositoryRoot(
      path.dirname(fileURLToPath(import.meta.url)),
    );

    // ローカルesbuildでworkspace依存とAWS SDKをバンドルする。
    this.handler = new lambdaNodejs.NodejsFunction(this, "PollyWorkerHandler", {
      functionName: `${productSlug}-${environment}-polly-worker`,
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(
        repositoryRoot,
        "lambdas",
        "polly-worker",
        "src",
        "index.ts",
      ),
      handler: "handler",
      depsLockFilePath: path.join(repositoryRoot, "pnpm-lock.yaml"),
      projectRoot: repositoryRoot,
      memorySize: 512,
      timeout: cdk.Duration.seconds(60),
      environment: {
        BUCKET_NAME: props.projectBucket.bucketName,
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

    // Pollyの音声合成を許可する。
    this.handler.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["polly:SynthesizeSpeech"],
        resources: ["*"],
      }),
    );

    // 実際のキーはuserId/projectId/versions/vNNNN/audio/...配下になる。
    props.projectBucket.grantWrite(this.handler, "*");
    // 入力テキストの読み取りを許可する。
    props.projectBucket.grantRead(this.handler);
  }
}
