import * as cdk from "aws-cdk-lib";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export interface TeaserStateMachineConstructProps {
  productSlug: string;
  environment: string;
  teaserGeneratorLambda: lambda.IFunction;
  pollyWorkerLambda: lambda.IFunction;
  teaserCompositionBuilderLambda: lambda.IFunction;
  renderStateMachine: sfn.StateMachine;
  projectBucket: s3.Bucket;
}

/**
 * Teaser State Machine: Step Functions Standard workflow for teaser video generation.
 * Flow: (1) teaser-generator (slide selection + hooks + post text)
 *       (2) Polly for selected slides teaserNotes
 *       (3) teaser-composition-builder (16:9)
 *       (4) render state machine (16:9)
 *       (5) optionally teaser-composition-builder (9:16) + render (9:16)
 */
export class TeaserStateMachineConstruct extends Construct {
  public readonly stateMachine: sfn.StateMachine;

  constructor(
    scope: Construct,
    id: string,
    props: TeaserStateMachineConstructProps,
  ) {
    super(scope, id);

    const { productSlug, environment } = props;

    // Step 1: Invoke teaser-generator Lambda (slide selection, hooks, post text)
    const generateTeaser = new tasks.LambdaInvoke(this, "GenerateTeaser", {
      lambdaFunction: props.teaserGeneratorLambda,
      resultPath: "$.teaserResult",
      retryOnServiceExceptions: true,
      comment: "Select slides, generate hook text and post text via Bedrock",
    });
    generateTeaser.addRetry({
      errors: ["Lambda.ServiceException", "Lambda.TooManyRequestsException"],
      interval: cdk.Duration.seconds(5),
      maxAttempts: 3,
      backoffRate: 2,
    });

    // Step 2: Map over selected slides -> Polly for each teaserNote
    const invokePolly = new tasks.LambdaInvoke(this, "InvokePollyForTeaser", {
      lambdaFunction: props.pollyWorkerLambda,
      payload: sfn.TaskInput.fromObject({
        "projectId.$": "$.projectId",
        "userId.$": "$.userId",
        "version.$": "$.versionNumber",
        "slideNumber.$": "$$.Map.Item.Value.slideNumber",
        "presenterNote.$": "$$.Map.Item.Value.teaserNote",
        "voiceId.$": "$.voiceId",
        "engine.$": "$.engine",
        "sampleRate.$": "$.sampleRate",
        "s3Bucket.$": "$.s3Bucket",
        "s3Prefix.$": "$.s3Prefix",
      }),
      resultPath: "$.pollyItemResult",
      retryOnServiceExceptions: true,
    });
    invokePolly.addRetry({
      errors: ["Lambda.ServiceException", "Lambda.TooManyRequestsException"],
      interval: cdk.Duration.seconds(2),
      maxAttempts: 3,
      backoffRate: 2,
    });

    const pollyMapState = new sfn.Map(this, "PollyMapOverSelectedSlides", {
      itemsPath: "$.teaserResult.Payload.selectedSlides",
      resultPath: "$.pollyResults",
      maxConcurrency: 5,
    });
    pollyMapState.itemProcessor(invokePolly);

    // Step 3: Invoke teaser composition builder for 16:9
    const buildComposition16x9 = new tasks.LambdaInvoke(
      this,
      "BuildTeaserComposition16x9",
      {
        lambdaFunction: props.teaserCompositionBuilderLambda,
        payload: sfn.TaskInput.fromObject({
          "projectId.$": "$.projectId",
          "userId.$": "$.userId",
          "versionNumber.$": "$.versionNumber",
          "jobId.$": "$.jobId",
          "s3Bucket.$": "$.s3Bucket",
          "s3Prefix.$": "$.s3Prefix",
          "assetsPrefix.$": "$.assetsPrefix",
          "selectedSlides.$": "$.teaserResult.Payload.selectedSlides",
          "hookText.$": "$.teaserResult.Payload.hookCandidates[0].text",
          "ctaText.$": "$.ctaText",
          "layout": "16x9",
        }),
        resultPath: "$.compositionResult16x9",
        retryOnServiceExceptions: true,
      },
    );
    buildComposition16x9.addRetry({
      errors: ["Lambda.ServiceException", "Lambda.TooManyRequestsException"],
      interval: cdk.Duration.seconds(2),
      maxAttempts: 3,
      backoffRate: 2,
    });

    // Step 4: Start Render State Machine for 16:9
    const startRender16x9 = new tasks.StepFunctionsStartExecution(
      this,
      "StartTeaserRender16x9",
      {
        stateMachine: props.renderStateMachine,
        integrationPattern: sfn.IntegrationPattern.RUN_JOB,
        resultPath: "$.renderResult16x9",
      },
    );

    // Step 5: Build 9:16 composition (optional parallel path)
    const buildComposition9x16 = new tasks.LambdaInvoke(
      this,
      "BuildTeaserComposition9x16",
      {
        lambdaFunction: props.teaserCompositionBuilderLambda,
        payload: sfn.TaskInput.fromObject({
          "projectId.$": "$.projectId",
          "userId.$": "$.userId",
          "versionNumber.$": "$.versionNumber",
          "jobId.$": "$.jobId",
          "s3Bucket.$": "$.s3Bucket",
          "s3Prefix.$": "$.s3Prefix",
          "assetsPrefix.$": "$.assetsPrefix",
          "selectedSlides.$": "$.teaserResult.Payload.selectedSlides",
          "hookText.$": "$.teaserResult.Payload.hookCandidates[0].text",
          "ctaText.$": "$.ctaText",
          "layout": "9x16",
        }),
        resultPath: "$.compositionResult9x16",
        retryOnServiceExceptions: true,
      },
    );
    buildComposition9x16.addRetry({
      errors: ["Lambda.ServiceException", "Lambda.TooManyRequestsException"],
      interval: cdk.Duration.seconds(2),
      maxAttempts: 3,
      backoffRate: 2,
    });

    // Step 6: Start Render for 9:16
    const startRender9x16 = new tasks.StepFunctionsStartExecution(
      this,
      "StartTeaserRender9x16",
      {
        stateMachine: props.renderStateMachine,
        integrationPattern: sfn.IntegrationPattern.RUN_JOB,
        resultPath: "$.renderResult9x16",
      },
    );

    // Chain: generateTeaser -> polly -> parallel(16:9 + 9:16)
    const render16x9Branch = buildComposition16x9.next(startRender16x9);
    const render9x16Branch = buildComposition9x16.next(startRender9x16);

    const parallelRenders = new sfn.Parallel(this, "ParallelRenders", {
      comment: "Run 16:9 and 9:16 composition+render in parallel",
      resultPath: "$.parallelRenderResults",
    });
    parallelRenders.branch(render16x9Branch);
    parallelRenders.branch(render9x16Branch);

    const definition = generateTeaser
      .next(pollyMapState)
      .next(parallelRenders);

    this.stateMachine = new sfn.StateMachine(this, "TeaserStateMachine", {
      stateMachineName: `${productSlug}-${environment}-teaser-pipeline`,
      definitionBody: sfn.DefinitionBody.fromChainable(definition),
      stateMachineType: sfn.StateMachineType.STANDARD,
      timeout: cdk.Duration.hours(2),
    });
  }
}
