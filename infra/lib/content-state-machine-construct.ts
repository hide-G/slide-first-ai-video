import * as cdk from "aws-cdk-lib";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

export interface ContentStateMachineConstructProps {
  productSlug: string;
  environment: string;
  marpLambda: lambda.IFunction;
  pollyWorkerLambda: lambda.IFunction;
  compositionBuilderLambda: lambda.IFunction;
  renderStateMachine: sfn.StateMachine;
}

/**
 * Content State Machine: Step Functions Standard state machine for content generation.
 * Flow: Bedrock generation -> Save to S3 -> Parallel (Marp + Polly) ->
 *   Timing Resolver -> Caption Generator -> Composition Builder -> Start Render.
 */
export class ContentStateMachineConstruct extends Construct {
  public readonly stateMachine: sfn.StateMachine;

  constructor(
    scope: Construct,
    id: string,
    props: ContentStateMachineConstructProps,
  ) {
    super(scope, id);

    const { productSlug, environment } = props;

    // Step 1: Invoke Bedrock for Marp generation (placeholder Task state)
    const generateContent = new sfn.Pass(this, "GenerateContent", {
      comment: "Invoke Bedrock for Marp generation (placeholder)",
      resultPath: "$.bedrockResult",
    });

    // Step 2: Save deck.md to S3
    const saveDeck = new sfn.Pass(this, "SaveDeckToS3", {
      comment: "Save generated deck.md to S3",
      resultPath: "$.saveDeckResult",
    });

    // Step 3: Wait for approval (callback pattern or separate trigger)
    const waitForApproval = new sfn.Pass(this, "WaitForApproval", {
      comment: "Wait for approval via callback or external trigger",
      resultPath: "$.approvalResult",
    });

    // Step 4: Parallel branches
    // Branch A: Invoke Marp Lambda for PDF/PPTX/PNG
    const invokeMarp = new tasks.LambdaInvoke(this, "InvokeMarpLambda", {
      lambdaFunction: props.marpLambda,
      resultPath: "$.marpResult",
      retryOnServiceExceptions: true,
    });
    invokeMarp.addRetry({
      errors: ["Lambda.ServiceException", "Lambda.TooManyRequestsException"],
      interval: cdk.Duration.seconds(2),
      maxAttempts: 3,
      backoffRate: 2,
    });

    // Branch B: Map over slides -> Invoke Polly Worker Lambda for each slide
    const invokePolly = new tasks.LambdaInvoke(this, "InvokePollyWorker", {
      lambdaFunction: props.pollyWorkerLambda,
      resultPath: "$.pollyItemResult",
      retryOnServiceExceptions: true,
    });
    invokePolly.addRetry({
      errors: ["Lambda.ServiceException", "Lambda.TooManyRequestsException"],
      interval: cdk.Duration.seconds(2),
      maxAttempts: 3,
      backoffRate: 2,
    });

    const pollyMapState = new sfn.Map(this, "PollyMapOverSlides", {
      itemsPath: "$.slides",
      resultPath: "$.pollyResults",
      maxConcurrency: 5,
    });
    pollyMapState.itemProcessor(invokePolly);

    // Parallel state for Marp + Polly
    const parallelProcessing = new sfn.Parallel(this, "ParallelMarpPolly", {
      resultPath: "$.parallelResults",
    });
    parallelProcessing.branch(invokeMarp);
    parallelProcessing.branch(pollyMapState);

    // Step 5: Invoke timing resolver Lambda (placeholder)
    const timingResolver = new sfn.Pass(this, "TimingResolver", {
      comment: "Invoke timing resolver Lambda",
      resultPath: "$.timingResult",
    });

    // Step 6: Invoke caption generator Lambda (placeholder)
    const captionGenerator = new sfn.Pass(this, "CaptionGenerator", {
      comment: "Invoke caption generator Lambda",
      resultPath: "$.captionResult",
    });

    // Step 7: Invoke composition builder Lambda
    const invokeCompositionBuilder = new tasks.LambdaInvoke(
      this,
      "InvokeCompositionBuilder",
      {
        lambdaFunction: props.compositionBuilderLambda,
        resultPath: "$.compositionResult",
        retryOnServiceExceptions: true,
      },
    );
    invokeCompositionBuilder.addRetry({
      errors: ["Lambda.ServiceException", "Lambda.TooManyRequestsException"],
      interval: cdk.Duration.seconds(2),
      maxAttempts: 3,
      backoffRate: 2,
    });

    // Step 8: Start Render State Machine
    const startRenderStateMachine = new tasks.StepFunctionsStartExecution(
      this,
      "StartRenderStateMachine",
      {
        stateMachine: props.renderStateMachine,
        integrationPattern: sfn.IntegrationPattern.RUN_JOB,
        resultPath: "$.renderResult",
      },
    );

    // Chain the steps
    const definition = generateContent
      .next(saveDeck)
      .next(waitForApproval)
      .next(parallelProcessing)
      .next(timingResolver)
      .next(captionGenerator)
      .next(invokeCompositionBuilder)
      .next(startRenderStateMachine);

    this.stateMachine = new sfn.StateMachine(this, "ContentStateMachine", {
      stateMachineName: `${productSlug}-${environment}-content-generation`,
      definitionBody: sfn.DefinitionBody.fromChainable(definition),
      stateMachineType: sfn.StateMachineType.STANDARD,
      timeout: cdk.Duration.hours(24),
    });
  }
}
