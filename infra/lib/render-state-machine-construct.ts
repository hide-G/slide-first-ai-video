import * as cdk from "aws-cdk-lib";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export interface RenderStateMachineConstructProps {
  productSlug: string;
  environment: string;
  projectBucket: s3.Bucket;
}

/**
 * Render State Machine: Step Functions Standard state machine for the render pipeline.
 * Flow: Plan -> Map (parallel chunk rendering) -> Assemble
 * Render Lambda: 10240MB memory, 4096MB ephemeral storage, 15 min timeout.
 */
export class RenderStateMachineConstruct extends Construct {
  public readonly stateMachine: sfn.StateMachine;
  public readonly renderLambda: lambda.Function;

  constructor(
    scope: Construct,
    id: string,
    props: RenderStateMachineConstructProps,
  ) {
    super(scope, id);

    const { productSlug, environment } = props;

    // Render Lambda: high-memory function for video rendering
    this.renderLambda = new lambda.Function(this, "RenderHandler", {
      functionName: `${productSlug}-${environment}-renderer`,
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("../lambdas/render-worker/dist"),
      memorySize: 10240,
      ephemeralStorageSize: cdk.Size.mebibytes(4096),
      timeout: cdk.Duration.minutes(15),
      environment: {
        BUCKET_NAME: props.projectBucket.bucketName,
      },
    });

    // Grant S3 read/write access
    props.projectBucket.grantReadWrite(this.renderLambda);

    // Step 1: Invoke render Lambda with Action=plan
    const planStep = new tasks.LambdaInvoke(this, "RenderPlan", {
      lambdaFunction: this.renderLambda,
      payload: sfn.TaskInput.fromObject({
        action: "plan",
        "input.$": "$",
      }),
      resultPath: "$.planResult",
      retryOnServiceExceptions: true,
    });
    planStep.addRetry({
      errors: ["Lambda.ServiceException", "Lambda.TooManyRequestsException"],
      interval: cdk.Duration.seconds(5),
      maxAttempts: 2,
      backoffRate: 2,
    });

    // Step 2: Map state over chunks -> Invoke render Lambda with Action=renderChunk
    const renderChunk = new tasks.LambdaInvoke(this, "RenderChunk", {
      lambdaFunction: this.renderLambda,
      payload: sfn.TaskInput.fromObject({
        action: "renderChunk",
        "chunk.$": "$",
      }),
      resultPath: "$.chunkResult",
      retryOnServiceExceptions: true,
    });
    renderChunk.addRetry({
      errors: ["Lambda.ServiceException", "Lambda.TooManyRequestsException"],
      interval: cdk.Duration.seconds(5),
      maxAttempts: 2,
      backoffRate: 2,
    });

    const mapChunks = new sfn.Map(this, "MapRenderChunks", {
      itemsPath: "$.planResult.Payload.chunks",
      resultPath: "$.chunkResults",
      maxConcurrency: 10,
    });
    mapChunks.itemProcessor(renderChunk);

    // Step 3: Invoke render Lambda with Action=assemble
    const assembleStep = new tasks.LambdaInvoke(this, "RenderAssemble", {
      lambdaFunction: this.renderLambda,
      payload: sfn.TaskInput.fromObject({
        action: "assemble",
        "chunkResults.$": "$.chunkResults",
        "planResult.$": "$.planResult",
      }),
      resultPath: "$.assembleResult",
      retryOnServiceExceptions: true,
    });
    assembleStep.addRetry({
      errors: ["Lambda.ServiceException", "Lambda.TooManyRequestsException"],
      interval: cdk.Duration.seconds(5),
      maxAttempts: 2,
      backoffRate: 2,
    });

    // Chain steps
    const definition = planStep.next(mapChunks).next(assembleStep);

    this.stateMachine = new sfn.StateMachine(this, "RenderStateMachine", {
      stateMachineName: `${productSlug}-${environment}-render-pipeline`,
      definitionBody: sfn.DefinitionBody.fromChainable(definition),
      stateMachineType: sfn.StateMachineType.STANDARD,
      timeout: cdk.Duration.hours(2),
    });
  }
}
