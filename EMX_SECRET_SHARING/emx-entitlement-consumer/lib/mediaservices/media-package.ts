import { Aws, Stack } from "aws-cdk-lib";
import { CfnChannel, CfnOriginEndpoint, CfnChannelGroup, CfnOriginEndpointPolicy } from "aws-cdk-lib/aws-mediapackagev2";
import { STACK_PREFIX_NAME } from "..";
import { Effect, PolicyDocument, PolicyStatement, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { Distribution } from "aws-cdk-lib/aws-cloudfront";

export function createMediaPackageChannelGroup(stack: Stack): CfnChannelGroup {
  return new CfnChannelGroup(stack, "mp-group", {
    channelGroupName: `${STACK_PREFIX_NAME}-entitled-channel-group`,
  });
}

export function createMediaPackage(stack: Stack, channelGroup: CfnChannelGroup, distribution: Distribution): {
  channel: CfnChannel,
  endpoint: CfnOriginEndpoint,
} {
  const channel = new CfnChannel(stack, "emp-channel", {
    channelName: `${STACK_PREFIX_NAME}-entitled-channel`,
    channelGroupName: channelGroup.channelGroupName,
    inputType: "CMAF"
  });

  const endpoint = new CfnOriginEndpoint(stack, "emp-endpoint", {
    channelGroupName: channelGroup.channelGroupName,
    channelName: channel.channelName,
    originEndpointName: `${STACK_PREFIX_NAME}-entitled-hls-output`,
    containerType: "TS",
    hlsManifests: [{
      manifestName: "index",
    }],
    startoverWindowSeconds: 10800,
  });

  const policy = new CfnOriginEndpointPolicy(stack, "origin-endpoint-policy", {
    channelGroupName: channelGroup.channelGroupName,
    channelName: channel.channelName,
    originEndpointName: endpoint.originEndpointName,
    policy: new PolicyDocument({
      statements: [
        new PolicyStatement({
          sid: "AllowRequestsFromCloudFront",
          effect: Effect.ALLOW,
          actions: [
            "mediapackagev2:GetObject",
            "mediapackagev2:GetHeadObject",
          ],
          principals: [
            new ServicePrincipal("cloudfront.amazonaws.com"),
          ],
          resources: [endpoint.attrArn],
          conditions: {
            StringEquals: {
              "aws:SourceArn": [`arn:aws:cloudfront::${Aws.ACCOUNT_ID}:distribution/${distribution.distributionId}` ],
            },
          },
        }),
      ]
    })
  });
  
  endpoint.addDependency(channel);
  channel.addDependency(channelGroup);
  policy.addDependency(endpoint);

  return {
    channel,
    endpoint,
  };
}

