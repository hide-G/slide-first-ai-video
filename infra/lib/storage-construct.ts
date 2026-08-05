import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";

export interface StorageConstructProps {
  productSlug: string;
  environment: string;
}

/**
 * Storage construct: S3 project bucket and DynamoDB single table.
 *
 * Uses single-table design with composite keys:
 *   PK (string) - partition key (e.g., PROJECT#id, JOB#id, IDEMPOTENCY#key)
 *   SK (string) - sort key (e.g., META, VERSION#0001)
 *   GSI1PK/GSI1SK - for access patterns like user's projects, project's jobs
 */
export class StorageConstruct extends Construct {
  public readonly projectBucket: s3.Bucket;
  public readonly table: dynamodb.Table;

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

    // DynamoDB: Single table design (PK: string, SK: string)
    this.table = new dynamodb.Table(this, "Table", {
      tableName: `${productSlug}-${environment}-table`,
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      timeToLiveAttribute: "ttl",
    });

    // GSI for access patterns: user's projects, project's jobs
    this.table.addGlobalSecondaryIndex({
      indexName: "GSI1",
      partitionKey: { name: "GSI1PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "GSI1SK", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
  }
}
