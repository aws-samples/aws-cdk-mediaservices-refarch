import { App, Stack } from "aws-cdk-lib";
import { createMediaPackage } from "../mediaservices/media-package";
import { createMediaLive, createMediaLiveInput } from "../mediaservices/media-live";
import { getMediaConnectOutputFlow } from "../mediaservices/media-connect";
import { INPUT_BUCKET_MP4_FILE, INPUT_BUCKET_NAME } from "../../config";

export const STACK_PREFIX_NAME = "MediaServicesRefArch";

export function createMediaLiveStack(app: App) {
  const stack = new Stack(app, `${STACK_PREFIX_NAME}-sustainable-workflow`, {
    env: {
      region: process.env.CDK_DEFAULT_REGION,
      account: process.env.CDK_DEFAULT_ACCOUNT,
    },
  });

  const mc = getMediaConnectOutputFlow(stack);
  const input = createMediaLiveInput(stack, INPUT_BUCKET_NAME, INPUT_BUCKET_MP4_FILE);
  const mp = createMediaPackage(stack);
  const ml = createMediaLive(stack, {
    mp,
    mxIP: mc.attrSourceIngestIp,
    mxPort: mc.attrSourceSourceIngestPort,
    input,
  });

  ml.addDependsOn(mp);
}
