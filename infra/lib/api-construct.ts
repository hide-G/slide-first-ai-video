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
import { Construct } from "constructs";

function findRepositoryRoot(startDirectory: string): string {
  let directory = startDirectory;

  while (true) {
    if (existsSync(path.join(directory, "pnpm-lock.yaml"))) {
      return directory;
    }

    const parentDirectory = path.dirname(directory);
    if (parentDirectory === directory) {
      throw new Error("pnpm-lock.yaml not found in any parent directory.");
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
  renderStateMachine: sfn.StateMachine;
  slideGeneratorLambda: lambda.IFunction;
  marpLambda: lambda.IFunction;
}

/**
 * API construct: API Gateway REST API with Cognito authorizer and Lambda integration.
 * Supports all 11 endpoints from the spec section 5.
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
        RENDER_STATE_MACHINE_ARN: props.renderStateMachine.stateMachineArn,
        SLIDE_GENERATOR_ARN: props.slideGeneratorLambda.functionArn,
        MARP_LAMBDA_ARN: props.marpLambda.functionArn,
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

    // Grant S3 read/write access (for presigned URLs and artifact listing)
    props.projectBucket.grantReadWrite(this.apiHandler);

    // Grant Step Functions start execution
    props.renderStateMachine.grantStartExecution(this.apiHandler);

    // Grant Lambda invoke for slide-generator and marp
    props.slideGeneratorLambda.grantInvoke(this.apiHandler);
    props.marpLambda.grantInvoke(this.apiHandler);

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

    // CORS gateway responses for 4XX/5XX
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

    // /projects
    const projects = this.api.root.addResource("projects");
    projects.addMethod("GET", lambdaIntegration, authOptions);
    projects.addMethod("POST", lambdaIntegration, authOptions);

    // /projects/{id}
    const projectId = projects.addResource("{id}");

    // /projects/{id}/outline
    const outline = projectId.addResource("outline");
    outline.addMethod("POST", lambdaIntegration, authOptions);
    outline.addMethod("PUT", lambdaIntegration, authOptions);

    // /projects/{id}/deck
    const deck = projectId.addResource("deck");
    deck.addMethod("POST", lambdaIntegration, authOptions);

    // /projects/{id}/source-upload-url
    const sourceUploadUrl = projectId.addResource("source-upload-url");
    sourceUploadUrl.addMethod("POST", lambdaIntegration, authOptions);

    // /projects/{id}/source
    const source = projectId.addResource("source");
    source.addMethod("POST", lambdaIntegration, authOptions);

    // /projects/{id}/output
    const output = projectId.addResource("output");
    output.addMethod("PUT", lambdaIntegration, authOptions);

    // /projects/{id}/narration
    const narration = projectId.addResource("narration");
    narration.addMethod("POST", lambdaIntegration, authOptions);
    narration.addMethod("PUT", lambdaIntegration, authOptions);

    // /projects/{id}/renders
    const renders = projectId.addResource("renders");
    renders.addMethod("POST", lambdaIntegration, authOptions);

    // /projects/{id}/renders/{renderId}
    const renderId = renders.addResource("{renderId}");
    renderId.addMethod("GET", lambdaIntegration, authOptions);

    // /projects/{id}/renders/{renderId}/artifacts
    const artifacts = renderId.addResource("artifacts");
    artifacts.addMethod("GET", lambdaIntegration, authOptions);
  }
}
