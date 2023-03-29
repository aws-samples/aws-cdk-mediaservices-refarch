import { App, Stack } from "aws-cdk-lib";
import { createMediaLive, createMediaLiveInput } from "../mediaservices/media-live";
import { createMediaConnectFlow } from "../mediaservices/media-connect";
import { IVpcTags } from "./networking";
import { STACK_PREFIX_NAME } from "..";

export function createMediaLiveStack(app: App, tags: IVpcTags): Stack {
  const stack = new Stack(app, `${STACK_PREFIX_NAME}-private-media-stack`, {
    env: {
      region: process.env.CDK_DEFAULT_REGION,
      account: process.env.CDK_DEFAULT_ACCOUNT,
    },
    description: "AWS CDK MediaServices Reference Architectures: Private Network video workflow. Stack contains MediaConnect and MediaLive.",
  });

  // Create MediaConnect Flow
  const mediaConnectFlow1A = createMediaConnectFlow(stack, "eu-west-1a");

  // Setup an input from Elemental Live Encoder to MediaLive (through MediaConnect)
  const input1A = createMediaLiveInput(stack, mediaConnectFlow1A.attrFlowArn);

  createMediaLive(stack, {
    input: input1A,
    tags,
  });

  return stack;
}
