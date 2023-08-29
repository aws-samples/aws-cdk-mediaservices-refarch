import { App, Stack } from "aws-cdk-lib";
import { createMediaLive, createMediaLiveInput } from "../mediaservices/media-live";
import { createMediaConnectFlow } from "../mediaservices/media-connect";
import { IVpcTags } from "./networking";
import { STACK_PREFIX_NAME } from "../../bin";

export class MediaLiveStack extends Stack {
  constructor(app: App, private vpcTags: IVpcTags) {
    super(app, `${STACK_PREFIX_NAME}-private-media-stack`, {
      env: {
        region: process.env.CDK_DEFAULT_REGION,
        account: process.env.CDK_DEFAULT_ACCOUNT,
      },
      description: "AWS CDK MediaServices Reference Architectures: Private Network video workflow. Stack contains MediaConnect and MediaLive.",
    });
  }

  // Create MediaConnect Flow
  protected mediaConnectFlow1A = createMediaConnectFlow(this, "eu-west-1a");

  // Setup an input from Elemental Live Encoder to MediaLive (through MediaConnect)
  protected input1A = createMediaLiveInput(this, this.mediaConnectFlow1A.attrFlowArn);

  protected eml = createMediaLive(this, {
    input: this.input1A,
    tags: this.vpcTags,
  });
}
