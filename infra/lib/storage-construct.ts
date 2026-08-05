import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";

export interface StorageConstructProps {
  productSlug: string;
  environment: string;
}

/**
 * Storage construct: S3 project bucket and DynamoDB tables.
 */
export class StorageConstruct extends Construct {
  public readonly projectBucket: s3.Bucket;
  public readonly projectsTable: dynamodb.Table;
  public readonly versionsTable: dynamodb.Table;
  public readonly jobsTable: dynamodb.Table;
  public readonly idempotencyTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: StorageConstructProps) {
    super(scope, id);

    const { productSlug, environment } = props;

    // S3 Project Bucket
    this.projectBucket = new s3.Bucket(this, "ProjectBucket", {
      bucketName: `${productSlug}-projects-${environment}-${cdk.Aws.ACCOUNT_ID}-${cdk.Aws.REGION}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          id: "expire-intermediate-chunks",
          prefix: "chunks/",
          expiration: cdk.Duration.days(7),
        },
      ],
    });

    // DynamoDB: Projects table (PK: userId, SK: projectId)
    this.projectsTable = new dynamodb.Table(this, "ProjectsTable", {
      tableName: `${productSlug}-${environment}-projects`,
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "projectId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // DynamoDB: Versions table (PK: projectId, SK: version)
    this.versionsTable = new dynamodb.Table(this, "VersionsTable", {
      tableName: `${productSlug}-${environment}-versions`,
      partitionKey: { name: "projectId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "version", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // DynamoDB: Jobs table (PK: jobId)
    this.jobsTable = new dynamodb.Table(this, "JobsTable", {
      tableName: `${productSlug}-${environment}-jobs`,
      partitionKey: { name: "jobId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // DynamoDB: Idempotency table (PK: idempotencyKey, TTL: 24h)
    this.idempotencyTable = new dynamodb.Table(this, "IdempotencyTable", {
      tableName: `${productSlug}-${environment}-idempotency`,
      partitionKey: {
        name: "idempotencyKey",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: "ttl",
    });
  }
}
