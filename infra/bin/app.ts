#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { MainStack } from "../src/main-stack.js";

const app = new cdk.App();

const productSlug = app.node.tryGetContext("productSlug") as string;
if (!productSlug) {
  throw new Error(
    "CDK context 'productSlug' is required. Pass it with -c productSlug=<value>",
  );
}

const env = app.node.tryGetContext("env") as string ?? "dev";

new MainStack(app, `${productSlug}-${env}`, {
  productSlug,
  env: {
    account: process.env["CDK_DEFAULT_ACCOUNT"],
    region: process.env["CDK_DEFAULT_REGION"],
  },
  envName: env,
});

app.synth();
