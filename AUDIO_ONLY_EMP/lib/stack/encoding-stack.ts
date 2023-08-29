import { Stack } from "aws-cdk-lib";
import { createMediaLive, createMediaLiveInput } from "../ms/media-live";
import { createMediaPackage } from "../ms/media-package";
import { createMediaConnectFlow } from "../ms/media-connect";
import { STACK_PREFIX_NAME } from "..";
import { Construct } from "constructs";

export class AudioOnlyEndcodingStack extends Stack {
  constructor(app: Construct) {
    super(app, `${STACK_PREFIX_NAME}-ao-encoding-video-stack`, {
      env: {
        region: process.env.CDK_DEFAULT_REGION,
        account: process.env.CDK_DEFAULT_ACCOUNT,
      },
      description:
        "AWS CDK MediaServices Reference Architectures: Audio Only workflow with EMP Origin. Stack contains MediaLive encoding pushing to EMP in Origin stack (with small video output).",
    });
  }

  protected mediaConnectFlow1A = createMediaConnectFlow(this, `${this.region}a`);
  protected input = createMediaLiveInput(this, this.mediaConnectFlow1A.attrFlowArn);
  protected mp = createMediaPackage(this);

  protected eml = createMediaLive(this, {
    input: this.input,
    mp: this.mp,
  });
}
