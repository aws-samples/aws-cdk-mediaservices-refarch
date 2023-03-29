import { CfnOutput, Stack } from "aws-cdk-lib";
import { CfnFlow } from "aws-cdk-lib/aws-mediaconnect";
import { STACK_PREFIX_NAME } from "..";
import { MEDIA_CONNECT_INPUT_WHITELIST_CIDR } from "../config";

/**
 * Create flow from Elemental Live Encoder to MediaConnect in the Cloud
 */
export function createMediaConnectFlow(stack: Stack, region: string): CfnFlow {
  const flow = new CfnFlow(stack, `private-media-emx-flow-${region}`, {
    name: `${STACK_PREFIX_NAME}-EMX-flow-${region}`,
    source: {
      name: "source-from-elemental-live-encoder",
      description: "MediaConnect flow for Private Networking sample.",
      protocol: "zixi-push",
      whitelistCidr: MEDIA_CONNECT_INPUT_WHITELIST_CIDR,
    },
    availabilityZone: region,
  });

  new CfnOutput(stack, "emx-input-flow", {
    exportName: `${stack.stackName}-emx-input-flow`,
    value: flow.ref,
  });

  return flow;
}
