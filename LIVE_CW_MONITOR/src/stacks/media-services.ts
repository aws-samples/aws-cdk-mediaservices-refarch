import { App, Stack } from "aws-cdk-lib";
import { createMediaPackage } from "../mediaservices/media-package";
import { createMediaLive, createMediaLiveInput } from "../mediaservices/media-live";
import { INPUT_BUCKET_MP4_FILE, INPUT_BUCKET_NAME } from "../config";

export const STACK_PREFIX_NAME = "MediaServicesRefArch";

export interface IMediaServicesOutput {
  emlId: string;
  empId: string;
}

export function createMediaLiveStack(app: App): IMediaServicesOutput {
  const stack = new Stack(app, `${STACK_PREFIX_NAME}-live-cw-monitoring-encoding-stack`, {
    env: {
      region: process.env.CDK_DEFAULT_REGION,
      account: process.env.CDK_DEFAULT_ACCOUNT,
    },
  });

  const input = createMediaLiveInput(stack, INPUT_BUCKET_NAME, INPUT_BUCKET_MP4_FILE);
  const mp = createMediaPackage(stack);
  const ml = createMediaLive(stack, {
    input,
    mp,
  });

  ml.addDependsOn(mp);

  return {
    emlId: ml.ref,
    empId: mp.ref,
  };
}
