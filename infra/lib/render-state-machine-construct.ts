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
  mediaconvertWorkerLambda: lambda.IFunction;
}

/**
 * 4-stage Render Pipeline State Machine.
 * Stages: pages -> audio -> captions -> video
 *
 * The video stage uses MediaConvert (submitted by mediaconvert-worker Lambda).
 * Supports partial retry via `startFromStage` input parameter.
 * A Choice state at the beginning routes execution to the requested starting stage,
 * skipping earlier stages that have already completed.
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

    // Stage 2: Audio (Polly - single invocation, processes all pages)
    const audioStage = new tasks.LambdaInvoke(this, "AudioStage", {
      lambdaFunction: props.pollyWorkerLambda,
      payload: sfn.TaskInput.fromObject({
        "stage": "audio",
        "projectId.$": "$.projectId",
        "userId.$": "$.userId",
        "renderId.$": "$.renderId",
        "s3Bucket.$": "$.s3Bucket",
        "s3Prefix.$": "$.s3Prefix",
      }),
      resultPath: "$.audioResult",
      retryOnServiceExceptions: true,
      comment: "Synthesize speech audio for all pages",
    });
    audioStage.addRetry({
      errors: ["Lambda.ServiceException", "Lambda.TooManyRequestsException"],
      interval: cdk.Duration.seconds(3),
      maxAttempts: 3,
      backoffRate: 2,
    });

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

    // Stage 4: Video (MediaConvert - submitted by mediaconvert-worker)
    const videoStage = new tasks.LambdaInvoke(this, "VideoStage", {
      lambdaFunction: props.mediaconvertWorkerLambda,
      payload: sfn.TaskInput.fromObject({
        "stage": "video",
        "projectId.$": "$.projectId",
        "userId.$": "$.userId",
        "renderId.$": "$.renderId",
        "s3Bucket.$": "$.s3Bucket",
        "s3Prefix.$": "$.s3Prefix",
      }),
      resultPath: "$.videoResult",
      retryOnServiceExceptions: true,
      comment: "Submit MediaConvert job for final video rendering",
    });
    videoStage.addRetry({
      errors: ["Lambda.ServiceException", "Lambda.TooManyRequestsException"],
      interval: cdk.Duration.seconds(5),
      maxAttempts: 2,
      backoffRate: 2,
    });

    // Chain stages: pages -> audio -> captions -> video
    pagesStage.next(audioStage);
    audioStage.next(captionsStage);
    captionsStage.next(videoStage);

    // Choice state to route to the correct starting stage based on startFromStage
    const stageChoice = new sfn.Choice(this, "ChooseStartStage", {
      comment: "Route to the requested starting stage (skip completed stages)",
    });

    stageChoice
      .when(sfn.Condition.stringEquals("$.startFromStage", "video"), videoStage)
      .when(sfn.Condition.stringEquals("$.startFromStage", "captions"), captionsStage)
      .when(sfn.Condition.stringEquals("$.startFromStage", "audio"), audioStage)
      .otherwise(pagesStage);

    this.stateMachine = new sfn.StateMachine(this, "RenderStateMachine", {
      stateMachineName: `${productSlug}-${environment}-render-pipeline`,
      definitionBody: sfn.DefinitionBody.fromChainable(stageChoice),
      stateMachineType: sfn.StateMachineType.STANDARD,
      timeout: cdk.Duration.hours(2),
    });
  }
}
