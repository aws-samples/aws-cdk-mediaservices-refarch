import { Stack } from "aws-cdk-lib";
import { CfnChannel, CfnOriginEndpoint } from "aws-cdk-lib/aws-mediapackage";
import { STACK_PREFIX_NAME } from "..";

export function createMediaPackage(stack: Stack): CfnChannel {
  const mp = new CfnChannel(stack, "emp-channel", {
    id: `${STACK_PREFIX_NAME}-ao-emp-channel`,
  });

  const endpoint = new CfnOriginEndpoint(stack, "mp-endpoint", {
    channelId: mp.id,
    id: `${STACK_PREFIX_NAME}-ao-emp-channel-hls-output`,
    hlsPackage: {
      segmentDurationSeconds: 10,
    },
  });

  endpoint.node.addDependency(mp);

  return mp;
}
