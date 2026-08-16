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
  marpLambda: lambda.IFunction;
  pollyWorkerLambda: lambda.IFunction;
  captionWorkerLambda: lambda.IFunction;
  clipWorkerLambda: lambda.IFunction;
  concatWorkerLambda: lambda.IFunction;
}

/**
 * 5-stage Render Pipeline State Machine.
 * Stages: pages -> audio -> captions -> clips -> concat
 *
 * Each stage checks manifest.stages[stage] and skips if already 'done'.
 * Failed stages can be retried independently via startFromStage parameter.
 */
export class RenderStateMachineConstruct extends Construct {
  public readonly stateMachine: sfn.StateMachine;

  constructor(
    scope: Construct,
    id: string,
    props: RenderStateMachineConstructProps,
  ) {
    super(scope, id);

    const { productSlug, environment } = props;

    // Stage 1: Pages (Marp render - generates PNG images per page)
    const pagesStage = new tasks.LambdaInvoke(this, "PagesStage", {
      lambdaFunction: props.marpLambda,
      payload: sfn.TaskInput.fromObject({
        "stage": "pages",
        "projectId.$": "$.projectId",
        "userId.$": "$.userId",
        "renderId.$": "$.renderId",
        "s3Bucket.$": "$.s3Bucket",
        "s3Prefix.$": "$.s3Prefix",
      }),
      resultPath: "$.pagesResult",
      retryOnServiceExceptions: true,
      comment: "Render slide pages to PNG images",
    });
    pagesStage.addRetry({
      errors: ["Lambda.ServiceException", "Lambda.TooManyRequestsException"],
      interval: cdk.Duration.seconds(5),
      maxAttempts: 2,
      backoffRate: 2,
    });

    // Stage 2: Audio (Polly - parallel per page using Map state)
    const pollyPerPage = new tasks.LambdaInvoke(this, "AudioPerPage", {
      lambdaFunction: props.pollyWorkerLambda,
      payload: sfn.TaskInput.fromObject({
        "stage": "audio",
        "page.$": "$",
        "projectId.$": "$$.Execution.Input.projectId",
        "userId.$": "$$.Execution.Input.userId",
        "renderId.$": "$$.Execution.Input.renderId",
        "s3Bucket.$": "$$.Execution.Input.s3Bucket",
        "s3Prefix.$": "$$.Execution.Input.s3Prefix",
      }),
      resultPath: "$.audioResult",
      retryOnServiceExceptions: true,
    });
    pollyPerPage.addRetry({
      errors: ["Lambda.ServiceException", "Lambda.TooManyRequestsException"],
      interval: cdk.Duration.seconds(3),
      maxAttempts: 3,
      backoffRate: 2,
    });

    const audioMap = new sfn.Map(this, "AudioMapPages", {
      itemsPath: "$.pagesResult.Payload.pages",
      resultPath: "$.audioResults",
      maxConcurrency: 5,
      comment: "Process audio for each page in parallel",
    });
    audioMap.itemProcessor(pollyPerPage);

    // Stage 3: Captions (generate SRT from audio timings)
    const captionsStage = new tasks.LambdaInvoke(this, "CaptionsStage", {
      lambdaFunction: props.captionWorkerLambda,
      payload: sfn.TaskInput.fromObject({
        "stage": "captions",
        "projectId.$": "$.projectId",
        "userId.$": "$.userId",
        "renderId.$": "$.renderId",
        "s3Bucket.$": "$.s3Bucket",
        "s3Prefix.$": "$.s3Prefix",
        "audioResults.$": "$.audioResults",
      }),
      resultPath: "$.captionsResult",
      retryOnServiceExceptions: true,
      comment: "Generate SRT captions from audio timings",
    });
    captionsStage.addRetry({
      errors: ["Lambda.ServiceException", "Lambda.TooManyRequestsException"],
      interval: cdk.Duration.seconds(5),
      maxAttempts: 2,
      backoffRate: 2,
    });

    // Stage 4: Clips (generate per-page video clips, parallel)
    const clipPerPage = new tasks.LambdaInvoke(this, "ClipPerPage", {
      lambdaFunction: props.clipWorkerLambda,
      payload: sfn.TaskInput.fromObject({
        "stage": "clips",
        "page.$": "$",
        "projectId.$": "$$.Execution.Input.projectId",
        "userId.$": "$$.Execution.Input.userId",
        "renderId.$": "$$.Execution.Input.renderId",
        "s3Bucket.$": "$$.Execution.Input.s3Bucket",
        "s3Prefix.$": "$$.Execution.Input.s3Prefix",
      }),
      resultPath: "$.clipResult",
      retryOnServiceExceptions: true,
    });
    clipPerPage.addRetry({
      errors: ["Lambda.ServiceException", "Lambda.TooManyRequestsException"],
      interval: cdk.Duration.seconds(5),
      maxAttempts: 2,
      backoffRate: 2,
    });

    const clipsMap = new sfn.Map(this, "ClipsMapPages", {
      itemsPath: "$.pagesResult.Payload.pages",
      resultPath: "$.clipResults",
      maxConcurrency: 5,
      comment: "Generate video clip for each page in parallel",
    });
    clipsMap.itemProcessor(clipPerPage);

    // Stage 5: Concat (concatenate all clips into final video)
    const concatStage = new tasks.LambdaInvoke(this, "ConcatStage", {
      lambdaFunction: props.concatWorkerLambda,
      payload: sfn.TaskInput.fromObject({
        "stage": "concat",
        "projectId.$": "$.projectId",
        "userId.$": "$.userId",
        "renderId.$": "$.renderId",
        "s3Bucket.$": "$.s3Bucket",
        "s3Prefix.$": "$.s3Prefix",
        "clipResults.$": "$.clipResults",
      }),
      resultPath: "$.concatResult",
      retryOnServiceExceptions: true,
      comment: "Concatenate clips into final video",
    });
    concatStage.addRetry({
      errors: ["Lambda.ServiceException", "Lambda.TooManyRequestsException"],
      interval: cdk.Duration.seconds(5),
      maxAttempts: 2,
      backoffRate: 2,
    });

    // Chain: pages -> audio (map) -> captions -> clips (map) -> concat
    const definition = pagesStage
      .next(audioMap)
      .next(captionsStage)
      .next(clipsMap)
      .next(concatStage);

    this.stateMachine = new sfn.StateMachine(this, "RenderStateMachine", {
      stateMachineName: `${productSlug}-${environment}-render-pipeline`,
      definitionBody: sfn.DefinitionBody.fromChainable(definition),
      stateMachineType: sfn.StateMachineType.STANDARD,
      timeout: cdk.Duration.hours(2),
    });
  }
}
