import { Stack } from "aws-cdk-lib";
import { createMediaPackage } from "../mediaservices/media-package";
import { createMediaLive, createMediaLiveInput } from "../mediaservices/media-live";
import { INPUT_BUCKET_MP4_FILE, INPUT_BUCKET_NAME } from "../config";
import { Construct } from "constructs";

export const STACK_PREFIX_NAME = "MediaServicesRefArch";

export interface IMediaServicesOutput {
  emlId: string;
  empId: string;
}

export class MediaStack extends Stack {
  constructor(app: Construct) {
    super(app, `${STACK_PREFIX_NAME}-live-cw-monitoring-encoding-stack`, {
      env: {
        region: process.env.CDK_DEFAULT_REGION,
        account: process.env.CDK_DEFAULT_ACCOUNT,
      },
    });
  }

  protected input = createMediaLiveInput(this, INPUT_BUCKET_NAME, INPUT_BUCKET_MP4_FILE);
  public mp = createMediaPackage(this);
  public ml = createMediaLive(this, {
    input: this.input,
    mp: this.mp,
  });
}
