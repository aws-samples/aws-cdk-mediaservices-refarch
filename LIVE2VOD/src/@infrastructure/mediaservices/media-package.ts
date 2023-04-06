import { CfnOutput, Stack } from "aws-cdk-lib";
import { CfnChannel, CfnOriginEndpoint, CfnPackagingConfiguration, CfnPackagingGroup } from "aws-cdk-lib/aws-mediapackage";
import { STACK_PREFIX_NAME } from "..";

export function createMediaPackage(stack: Stack): CfnChannel {
  const mp = new CfnChannel(stack, "mp-channel", {
    id: `${STACK_PREFIX_NAME}-L2V-EMP-channel`,
  });

  const endpoint = new CfnOriginEndpoint(stack, "mp-endpoint", {
    channelId: mp.id,
    id: `${STACK_PREFIX_NAME}-L2V-EMP-hls-output`,
    hlsPackage: {},
    startoverWindowSeconds: 10800,
  });

  endpoint.node.addDependency(mp);

  new CfnOutput(stack, "emp-channel-output", {
    value: mp.ref,
    exportName: `${stack.stackName}-emp-channel-output`,
  });

  new CfnOutput(stack, "emp-channel-hls-output", {
    value: endpoint.ref,
    exportName: `${stack.stackName}-emp-channel-hls-output`,
  });

  return mp;
}

export function createMediaPackageVodGroup(stack: Stack): CfnPackagingGroup {
  const mp = new CfnPackagingGroup(stack, "mp-packaging-group", {
    id: `${STACK_PREFIX_NAME}-L2V-EMP-packaging-group`,
  });

  const mpVod = new CfnPackagingConfiguration(stack, "mp-packaging-configuration", {
    id: `${STACK_PREFIX_NAME}-L2V-EMP-hls-packaging-config`,
    packagingGroupId: mp.id,
    hlsPackage: {
      hlsManifests: [
        {
          manifestName: "index",
        },
      ],
    },
  });

  mpVod.addDependsOn(mp);
  return mp;
}
