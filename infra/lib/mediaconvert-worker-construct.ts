import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export interface MediaConvertWorkerConstructProps {
  productSlug: string;
  environment: string;
  projectBucket: s3.Bucket;
}

/**
 * MediaConvert Worker Lambda construct.
 * Stage 4: Video - submits MediaConvert jobs for final video rendering.
 * Memory 512MB, timeout 300s.
 *
 * Creates:
 * - A MediaConvert IAM service role (assumed by MediaConvert to access S3)
 * - The Lambda function with permissions:
 *   - S3 read/write on the project bucket
 *   - mediaconvert:CreateJob, mediaconvert:GetJob
 *   - iam:PassRole restricted to the MediaConvert service role
 */
export class MediaConvertWorkerConstruct extends Construct {
  public readonly handler: lambda.Function;
  public readonly mediaConvertRole: iam.Role;

  constructor(
    scope: Construct,
    id: string,
    props: MediaConvertWorkerConstructProps,
  ) {
    super(scope, id);

    const { productSlug, environment } = props;

    // MediaConvert IAM service role - assumed by the MediaConvert service
    // to read input files and write output files in S3
    this.mediaConvertRole = new iam.Role(this, "MediaConvertServiceRole", {
      roleName: `${productSlug}-${environment}-mediaconvert-role`,
      assumedBy: new iam.ServicePrincipal("mediaconvert.amazonaws.com"),
      description:
        "IAM role assumed by AWS MediaConvert to access S3 for video rendering",
    });

    // Grant MediaConvert role read/write on the project bucket
    this.mediaConvertRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["s3:GetObject", "s3:PutObject"],
        resources: [props.projectBucket.arnForObjects("*")],
      }),
    );
    this.mediaConvertRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["s3:ListBucket"],
        resources: [props.projectBucket.bucketArn],
      }),
    );

    // Lambda function
    this.handler = new lambda.Function(this, "MediaConvertWorkerHandler", {
      functionName: `${productSlug}-${environment}-mediaconvert-worker`,
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("../lambdas/mediaconvert-worker/dist"),
      memorySize: 512,
      timeout: cdk.Duration.seconds(300),
      environment: {
        BUCKET_NAME: props.projectBucket.bucketName,
        MEDIACONVERT_ROLE_ARN: this.mediaConvertRole.roleArn,
      },
    });

    // Grant S3 read/write to the Lambda execution role
    props.projectBucket.grantReadWrite(this.handler);

    // Grant MediaConvert API permissions to the Lambda execution role
    this.handler.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["mediaconvert:CreateJob", "mediaconvert:GetJob"],
        resources: ["*"],
      }),
    );

    // Grant iam:PassRole restricted to the MediaConvert service role only
    this.handler.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["iam:PassRole"],
        resources: [this.mediaConvertRole.roleArn],
      }),
    );
  }
}
