import { App, Stack } from "aws-cdk-lib";
import { createMediaLive, createMediaLiveInput } from "../ms/media-live";
import { createMediaPackage } from "../ms/media-package";
import { createMediaConnectFlow } from "../ms/media-connect";
import { STACK_PREFIX_NAME } from "..";

export function getAudioOnlyEndcodingStack(app: App) {
  const stack = new Stack(app, `${STACK_PREFIX_NAME}-ao-encoding-video-stack`, {
    env: {
      region: process.env.CDK_DEFAULT_REGION,
      account: process.env.CDK_DEFAULT_ACCOUNT,
    },
    description:
      "AWS CDK MediaServices Reference Architectures: Audio Only workflow with EMP Origin. Stack contains MediaLive encoding pushing to EMP in Origin stack (with small video output).",
  });

  const mediaConnectFlow1A = createMediaConnectFlow(stack, `${stack.region}a`);
  const input = createMediaLiveInput(stack, mediaConnectFlow1A.attrFlowArn);

  const mp = createMediaPackage(stack);

  createMediaLive(stack, {
    input,
    mp,
  });
}
