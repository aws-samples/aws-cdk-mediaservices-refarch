import { CfnOutput, Stack } from "aws-cdk-lib";
import { CfnFlow } from "aws-cdk-lib/aws-mediaconnect";
import { STACK_PREFIX_NAME } from "..";
import { DEST_MEDIA_CONNECT_WHITELIST_CIDR } from "../config";

/**
 * Create input flow
 */
export function createMediaConnectFlow(stack: Stack, region: string): CfnFlow {
  const flow = new CfnFlow(stack, `flow-${region}`, {
    name: `${STACK_PREFIX_NAME}-L2V-flow-${region}`,
    source: {
      name: "source-to-emx",
      protocol: "zixi-push",
      whitelistCidr: DEST_MEDIA_CONNECT_WHITELIST_CIDR,
    },
    availabilityZone: region,
  });

  new CfnOutput(stack, "emx-input-flow", {
    exportName: `${stack.stackName}-emx-input-flow`,
    value: flow.ref,
  });

  return flow;
}
