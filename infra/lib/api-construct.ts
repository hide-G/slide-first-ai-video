import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export interface ApiConstructProps {
  productSlug: string;
  environment: string;
  userPool: cognito.UserPool;
  table: dynamodb.Table;
  projectBucket: s3.Bucket;
  contentStateMachine: sfn.StateMachine;
  renderStateMachine: sfn.StateMachine;
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

    // API Lambda handler
    this.apiHandler = new lambda.Function(this, "ApiHandler", {
      functionName: `${productSlug}-${environment}-api`,
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("../lambdas/api/dist"),
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: {
        TABLE_NAME: props.table.tableName,
        BUCKET_NAME: props.projectBucket.bucketName,
        CONTENT_STATE_MACHINE_ARN: props.contentStateMachine.stateMachineArn,
        VIDEO_STATE_MACHINE_ARN: props.renderStateMachine.stateMachineArn,
        APPROVAL_QUEUE_URL: props.approvalQueue.queueUrl,
      },
    });

    // Grant DynamoDB access
    props.table.grantReadWriteData(this.apiHandler);

    // Grant S3 read access
    props.projectBucket.grantRead(this.apiHandler);

    // Grant Step Functions start execution
    props.contentStateMachine.grantStartExecution(this.apiHandler);
    props.renderStateMachine.grantStartExecution(this.apiHandler);

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

    // REST API
    this.api = new apigateway.RestApi(this, "RestApi", {
      restApiName: `${productSlug}-${environment}-api`,
      deployOptions: {
        stageName: "v1",
      },
    });

    const lambdaIntegration = new apigateway.LambdaIntegration(
      this.apiHandler,
    );
    const authOptions: apigateway.MethodOptions = {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    };

    // Routes: POST /v1/projects
    const projects = this.api.root.addResource("projects");
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
