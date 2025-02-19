import { App, Stack } from "aws-cdk-lib";
import { CfnFlow } from "aws-cdk-lib/aws-mediaconnect";
import { EmxEntitlementGrant } from "./granter-construct";
import { ALGORITHM } from "./helpers/algorithm";
import { createMediaLive, createMediaLiveInput } from "./media-services/medialive";

export class EmxEntitlementGrantStack extends Stack {
  constructor(app: App) {
    super(app, "EmxEntitlementGrantStack", {});
  }
  
  /**
   * 1/ Create an EMX flow
   *
   * This will be for the source content
   */
  protected emx = new CfnFlow(this, "b2b-output-flow", {
    name: "EMXSecretSharePoC-b2b-output",
    source: {
      name: "EMXSecretSharePoC-MediaLive-to-MediaConnect",
      description: "distribution from MediaLive to entitled accounts",
      protocol: "rtp-fec",
      whitelistCidr: "0.0.0.0/0", // Ensure you lockdown to the output of MediaLive after initial deployment
    },
  });

  /**
   * Setup supporting infrastructure to push to MediaConnect Flow (and to entitled account downstream)
   */
  protected input = createMediaLiveInput(this, "s3://....");
  protected medialive = createMediaLive(this, {
    input: this.input,
    output: this.emx,
  });

  /**
   * 2/ Construct to build out entitlement flows
   *
   * This is per a customer/entitlement - so you can ensure secrets aren't shared across multiple entitlements.
   */
  protected entitlements = new EmxEntitlementGrant(this, {
    streamIdentifier: "c1",
    accountId: "....",
    consumerRoleArn: "arn:aws:iam::....",
    algorithm: ALGORITHM.AES256,
    emxFlow: this.emx,
  });
}
