import * as cdk from "aws-cdk-lib";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";

export interface ContentStateMachineConstructProps {
  productSlug: string;
  environment: string;
  slideGeneratorLambda: lambda.IFunction;
  marpLambda: lambda.IFunction;
  pollyWorkerLambda: lambda.IFunction;
  compositionBuilderLambda: lambda.IFunction;
  renderStateMachine: sfn.StateMachine;
  table: dynamodb.Table;
}

/**
 * Content State Machine: Step Functions Standard state machine for content generation.
 * Flow: Bedrock generation -> Save to S3 -> WaitForApproval (callback token) ->
 *   Parallel (Marp + Polly) -> Timing Resolver -> Caption Generator ->
 *   Composition Builder -> Start Render.
 *
 * The WaitForApproval step uses a callback token pattern: the state machine pauses
 * and stores the task token. When the user calls POST /approve, the API sends
 * SendTaskSuccess with the stored token to resume execution.
 */
export class ContentStateMachineConstruct extends Construct {
  public readonly stateMachine: sfn.StateMachine;
  public readonly approvalQueue: sqs.Queue;

  constructor(
    scope: Construct,
    id: string,
    props: ContentStateMachineConstructProps,
  ) {
    super(scope, id);

    const { productSlug, environment } = props;

    // SQS queue for approval callback tokens
    this.approvalQueue = new sqs.Queue(this, "ApprovalQueue", {
      queueName: `${productSlug}-${environment}-approval-queue`,
      visibilityTimeout: cdk.Duration.seconds(30),
      retentionPeriod: cdk.Duration.days(14),
    });

    // Step 1: Invoke Bedrock slide generation via slide-generator Lambda
    const generateContent = new tasks.LambdaInvoke(
      this,
      "GenerateContent",
      {
        lambdaFunction: props.slideGeneratorLambda,
        resultPath: "$.bedrockResult",
        retryOnServiceExceptions: true,
        comment: "Invoke Bedrock for Marp slide generation",
      },
    );
    generateContent.addRetry({
      errors: ["Lambda.ServiceException", "Lambda.TooManyRequestsException"],
      interval: cdk.Duration.seconds(5),
      maxAttempts: 3,
      backoffRate: 2,
    });

    // Step 2: Save deck.md to S3
    const saveDeck = new sfn.Pass(this, "SaveDeckToS3", {
      comment: "Save generated deck.md to S3",
      resultPath: "$.saveDeckResult",
    });

    // Step 3: Wait for approval via SQS callback token pattern
    // The task token is sent to SQS. The API reads it and calls SendTaskSuccess
    // when the user approves the version.
    const waitForApproval = new tasks.SqsSendMessage(
      this,
      "WaitForApproval",
      {
        queue: this.approvalQueue,
        messageBody: sfn.TaskInput.fromObject({
          "taskToken": sfn.JsonPath.taskToken,
          "projectId.$": "$.projectId",
          "userId.$": "$.userId",
          "versionNumber.$": "$.versionNumber",
        }),
        integrationPattern: sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
        resultPath: "$.approvalResult",
        comment:
          "Pause execution until user approves slides. Task token stored in SQS for the approve API to retrieve.",
      },
    );

    // Step 4: Parallel branches
    // Branch A: Invoke Marp Lambda for PDF/PPTX/PNG
    // Payload transforms the state into the MarpRenderEvent shape the Lambda expects
    const invokeMarp = new tasks.LambdaInvoke(this, "InvokeMarpLambda", {
      lambdaFunction: props.marpLambda,
      payload: sfn.TaskInput.fromObject({
        "projectId.$": "$.projectId",
        "userId.$": "$.userId",
        "version.$": "$.versionNumber",
        "deckMarkdown.$": "$.bedrockResult.Payload.rawMarkdown",
        "s3Bucket.$": "$.s3Bucket",
        "s3Prefix.$": "$.s3Prefix",
        outputs: ["pdf", "pptx", "png"],
      }),
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
    // Each iteration item is transformed into a PollyWorkerEvent
    const invokePolly = new tasks.LambdaInvoke(this, "InvokePollyWorker", {
      lambdaFunction: props.pollyWorkerLambda,
      payload: sfn.TaskInput.fromObject({
        "projectId.$": "$.projectId",
        "userId.$": "$.userId",
        "version.$": "$.versionNumber",
        "slideNumber.$": "$$.Map.Item.Value.slideNumber",
        "presenterNote.$": "$$.Map.Item.Value.presenterNote",
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

    const pollyMapState = new sfn.Map(this, "PollyMapOverSlides", {
      itemsPath: "$.bedrockResult.Payload.slides",
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
