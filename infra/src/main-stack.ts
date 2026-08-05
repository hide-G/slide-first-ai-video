import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

export interface MainStackProps extends cdk.StackProps {
  productSlug: string;
  environment: string;
}

/**
 * Main CDK stack for the slide-first AI video application.
 * Placeholder: concrete resources will be added in subsequent features.
 */
export class MainStack extends cdk.Stack {
  public readonly productSlug: string;
  public readonly environment: string;

  constructor(scope: Construct, id: string, props: MainStackProps) {
    super(scope, id, props);

    this.productSlug = props.productSlug;
    this.environment = props.environment;

    // Tag all resources with product slug and environment
    cdk.Tags.of(this).add("Product", props.productSlug);
    cdk.Tags.of(this).add("Environment", props.environment);
  }
}
