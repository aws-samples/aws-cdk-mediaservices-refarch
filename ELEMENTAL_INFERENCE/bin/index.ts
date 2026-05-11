import { App, Aspects } from "aws-cdk-lib";
import { AwsSolutionsChecks } from "cdk-nag";
import { ElementalInferenceStack } from "../lib/stack/elemental-inference-stack";
import { STACK_PREFIX_NAME } from "../lib/config";

const app = new App();

new ElementalInferenceStack(app, `${STACK_PREFIX_NAME}-stack`, {
  env: {
    region: process.env.CDK_DEFAULT_REGION,
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
  description:
    "AWS CDK Elemental Inference Reference Architecture: MediaLive with Smart Crop and Event Clipping via Elemental Inference, packaged through MediaPackageV2 with a metadata REST API.",
});

Aspects.of(app).add(new AwsSolutionsChecks());
