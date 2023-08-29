import { Stack } from "aws-cdk-lib";
import { createMediaPackage } from "../mediaservices/media-package";
import { createMediaLive, createMediaLiveInput } from "../mediaservices/media-live";
import { getMediaConnectOutputFlow } from "../mediaservices/media-connect";
import { INPUT_BUCKET_MP4_FILE, INPUT_BUCKET_NAME } from "../config";
import { Construct } from "constructs";

export const STACK_PREFIX_NAME = "MediaServicesRefArch";

export class MediaLiveStack extends Stack {
  constructor(app: Construct) {
    super(app, `${STACK_PREFIX_NAME}-sustainable-workflow`, {
      env: {
        region: process.env.CDK_DEFAULT_REGION,
        account: process.env.CDK_DEFAULT_ACCOUNT,
      },
    });
  }

  protected mc = getMediaConnectOutputFlow(this);
  protected input = createMediaLiveInput(this, INPUT_BUCKET_NAME, INPUT_BUCKET_MP4_FILE);
  protected mp = createMediaPackage(this);
  protected ml = createMediaLive(this, {
    mp: this.mp,
    mxIP: this.mc.attrSourceIngestIp,
    mxPort: this.mc.attrSourceSourceIngestPort,
    input: this.input,
  });
}
