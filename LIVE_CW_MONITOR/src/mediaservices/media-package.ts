import { CfnOutput, Stack } from "aws-cdk-lib";
import { CfnChannel, CfnOriginEndpoint } from "aws-cdk-lib/aws-mediapackage";

export function createMediaPackage(stack: Stack) {
  const mp = new CfnChannel(stack, "sustainable-emp-channel", {
    id: `${stack.stackName}-EMP-channel`,
  });
  const ep = new CfnOriginEndpoint(stack, "emp-endpoint", {
    channelId: mp.id,
    id: `${stack.stackName}-EMP-hls-output`,
    hlsPackage: {},
  });

  ep.addDependsOn(mp);

  new CfnOutput(stack, "emp-channel-output", {
    value: mp.ref,
    exportName: "emp-channel-output",
  });

  new CfnOutput(stack, "emp-channel-hls-output", {
    value: ep.ref,
    exportName: "emp-channel-hls-output",
  });

  return mp;
}
