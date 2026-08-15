import { existsSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as sqs from "aws-cdk-lib/aws-sqs";
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

export interface ApiConstructProps {
  productSlug: string;
  environment: string;
  userPool: cognito.UserPool;
  table: dynamodb.Table;
  projectBucket: s3.Bucket;
  contentStateMachine: sfn.StateMachine;
  renderStateMachine: sfn.StateMachine;
  teaserStateMachine: sfn.StateMachine;
  approvalQueue: sqs.Queue;
}

/**
 * API construct: API Gateway REST API with Cognito authorizer and Lambda integration.
 */
export class ApiConstruct extends Construct {
  public readonly api: apigateway.RestApi;
  public readonly apiHandler: lambda.Function;

  constructor(scope: Construct, id: string, props: ApiConstructProps) {
    super(scope, id);

    const { productSlug, environment } = props;
    const repositoryRoot = findRepositoryRoot(
      path.dirname(fileURLToPath(import.meta.url)),
    );

    // API Lambdaをローカルesbuildでバンドルし、workspace依存を同梱する。
    this.apiHandler = new lambdaNodejs.NodejsFunction(this, "ApiHandler", {
      functionName: `${productSlug}-${environment}-api`,
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(repositoryRoot, "lambdas", "api", "src", "index.ts"),
      handler: "handler",
      depsLockFilePath: path.join(repositoryRoot, "pnpm-lock.yaml"),
      projectRoot: repositoryRoot,
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: {
        TABLE_NAME: props.table.tableName,
        BUCKET_NAME: props.projectBucket.bucketName,
        CONTENT_STATE_MACHINE_ARN: props.contentStateMachine.stateMachineArn,
        VIDEO_STATE_MACHINE_ARN: props.renderStateMachine.stateMachineArn,
        TEASER_STATE_MACHINE_ARN: props.teaserStateMachine.stateMachineArn,
        APPROVAL_QUEUE_URL: props.approvalQueue.queueUrl,
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

    // Grant DynamoDB access
    props.table.grantReadWriteData(this.apiHandler);

    // Grant S3 read access
    props.projectBucket.grantRead(this.apiHandler);

    // Grant Step Functions start execution
    props.contentStateMachine.grantStartExecution(this.apiHandler);
    props.renderStateMachine.grantStartExecution(this.apiHandler);
    props.teaserStateMachine.grantStartExecution(this.apiHandler);

    // Grant SQS receive/delete on approval queue
    props.approvalQueue.grantConsumeMessages(this.apiHandler);

    // Grant states:SendTaskSuccess for resuming the content state machine
    this.apiHandler.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["states:SendTaskSuccess"],
        resources: [props.contentStateMachine.stateMachineArn],
      }),
    );

    // Cognito authorizer
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(
      this,
      "CognitoAuthorizer",
      {
        cognitoUserPools: [props.userPool],
        authorizerName: `${productSlug}-${environment}-cognito-authorizer`,
      },
    );

    const corsAllowHeaders = [
      "Content-Type",
      "Authorization",
      "X-Amz-Date",
      "X-Api-Key",
      "Idempotency-Key",
    ];
    const corsResponseHeaders = {
      "Access-Control-Allow-Origin": "'*'",
      "Access-Control-Allow-Headers": `'${corsAllowHeaders.join(",")}'`,
      "Access-Control-Allow-Methods": "'GET,POST,PUT,DELETE,OPTIONS'",
    };

    // REST API
    this.api = new apigateway.RestApi(this, "RestApi", {
      restApiName: `${productSlug}-${environment}-api`,
      deployOptions: {
        stageName: "v1",
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: corsAllowHeaders,
      },
    });

    // Lambdaに到達しない4XX/5XXとCognito認可失敗の401/403にもCORSを付与する。
    new apigateway.GatewayResponse(this, "Default4xxCorsResponse", {
      restApi: this.api,
      type: apigateway.ResponseType.DEFAULT_4XX,
      responseHeaders: corsResponseHeaders,
    });
    new apigateway.GatewayResponse(this, "Default5xxCorsResponse", {
      restApi: this.api,
      type: apigateway.ResponseType.DEFAULT_5XX,
      responseHeaders: corsResponseHeaders,
    });
    new apigateway.GatewayResponse(this, "UnauthorizedCorsResponse", {
      restApi: this.api,
      type: apigateway.ResponseType.UNAUTHORIZED,
      responseHeaders: corsResponseHeaders,
    });
    new apigateway.GatewayResponse(this, "AccessDeniedCorsResponse", {
      restApi: this.api,
      type: apigateway.ResponseType.ACCESS_DENIED,
      responseHeaders: corsResponseHeaders,
    });

    const lambdaIntegration = new apigateway.LambdaIntegration(
      this.apiHandler,
    );
    const authOptions: apigateway.MethodOptions = {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    };

    // Routes: GET /v1/projects (list), POST /v1/projects (create)
    const projects = this.api.root.addResource("projects");
    projects.addMethod("GET", lambdaIntegration, authOptions);
    projects.addMethod("POST", lambdaIntegration, authOptions);

    // Routes: POST /v1/projects/{id}/slides
    const projectId = projects.addResource("{id}");
    const slides = projectId.addResource("slides");
    slides.addMethod("POST", lambdaIntegration, authOptions);

    // Routes: GET /v1/projects/{id}/versions/{version}
    const versions = projectId.addResource("versions");
    const version = versions.addResource("{version}");
    version.addMethod("GET", lambdaIntegration, authOptions);

    // Routes: POST /v1/projects/{id}/versions/{version}/approve
    const approve = version.addResource("approve");
    approve.addMethod("POST", lambdaIntegration, authOptions);

    // Routes: POST /v1/projects/{id}/videos
    const videos = projectId.addResource("videos");
    videos.addMethod("POST", lambdaIntegration, authOptions);

    // Routes: POST /v1/projects/{id}/videos/teaser
    const teaser = videos.addResource("teaser");
    teaser.addMethod("POST", lambdaIntegration, authOptions);

    // Routes: GET /v1/projects/{id}/deliverables
    const deliverables = projectId.addResource("deliverables");
    deliverables.addMethod("GET", lambdaIntegration, authOptions);

    // Routes: GET /v1/jobs/{jobId}
    const jobs = this.api.root.addResource("jobs");
    const jobId = jobs.addResource("{jobId}");
    jobId.addMethod("GET", lambdaIntegration, authOptions);
  }
}
