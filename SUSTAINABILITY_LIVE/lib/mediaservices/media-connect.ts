import { CfnOutput, Stack } from "aws-cdk-lib";
import { CfnFlow } from "aws-cdk-lib/aws-mediaconnect";
import { DEST_MEDIA_CONNECT_WHITELIST_CIDR } from "../config";

export function getMediaConnectOutputFlow(stack: Stack) {
  const flow = new CfnFlow(stack, "example-destination-flow", {
    name: `${stack.stackName}-EMX-destination-flow`,
    source: {
      name: "distribution-from-EML",
      description: "EML to EMX",
      protocol: "rtp-fec",
      whitelistCidr: DEST_MEDIA_CONNECT_WHITELIST_CIDR,
    },
    availabilityZone: `${stack.region}a`,
  });

  new CfnOutput(stack, "emx-destination-flow-output", {
    exportName: `${stack.stackName}-emx-destination-flow-output`,
    value: flow.ref,
  });

  return flow;
}
