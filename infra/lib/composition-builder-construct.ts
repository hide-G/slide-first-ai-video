import { existsSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import * as cdk from "aws-cdk-lib";
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

export interface CompositionBuilderConstructProps {
  productSlug: string;
  environment: string;
  projectBucket: s3.Bucket;
}

/**
 * コンポジションを生成するLambda Construct。
 * メモリ512MiB、タイムアウト60秒、S3の読み書きを許可する。
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
    const repositoryRoot = findRepositoryRoot(
      path.dirname(fileURLToPath(import.meta.url)),
    );

    // ローカルesbuildでworkspace依存とAWS SDKをバンドルする。
    this.handler = new lambdaNodejs.NodejsFunction(
      this,
      "CompositionBuilderHandler",
      {
        functionName: `${productSlug}-${environment}-composition-builder`,
        runtime: lambda.Runtime.NODEJS_22_X,
        entry: path.join(
          repositoryRoot,
          "lambdas",
          "composition-builder",
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
      },
    );

    // アセットの読み取りとHTML成果物の書き込みを許可する。
    props.projectBucket.grantReadWrite(this.handler);
  }
}
