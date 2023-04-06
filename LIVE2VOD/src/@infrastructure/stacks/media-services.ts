import { App, Stack } from "aws-cdk-lib";
import { createMediaLive, createMediaLiveInput } from "../mediaservices/media-live";
import { createMediaConnectFlow } from "../mediaservices/media-connect";
import { createMediaPackage, createMediaPackageVodGroup } from "../mediaservices/media-package";
import { STACK_PREFIX_NAME } from "..";

export interface IMediaServicesOutput {
  stack: Stack;
  mediapackageArn: string;
  mpVodPackagingGroup: string;
}

export function createMediaLiveStack(app: App): IMediaServicesOutput {
  const stack = new Stack(app, `${STACK_PREFIX_NAME}-L2V-media-stack`, {
    env: {
      region: process.env.CDK_DEFAULT_REGION,
      account: process.env.CDK_DEFAULT_ACCOUNT,
    },
  });

  // Create MediaConnect Flow
  const mediaConnectFlow1A = createMediaConnectFlow(stack, `${stack.region}a`);

  // Setup an input from Elemental Live Encoder to MediaLive (through MediaConnect)
  const input = createMediaLiveInput(stack, mediaConnectFlow1A.attrFlowArn);

  const mp = createMediaPackage(stack);

  const mpVodPackagingGroup = createMediaPackageVodGroup(stack);
  const medialive = createMediaLive(stack, {
    input,
    mp,
  });

  medialive.node.addDependency(mp);

  return {
    stack,
    mediapackageArn: mp.attrArn,
    mpVodPackagingGroup: mpVodPackagingGroup.id,
  };
}
