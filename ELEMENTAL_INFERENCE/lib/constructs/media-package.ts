/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */

import { CfnOutput, Fn } from "aws-cdk-lib";
import {
  CfnChannelGroup,
  CfnChannel,
  CfnOriginEndpoint,
  CfnChannelPolicy,
  CfnOriginEndpointPolicy,
} from "aws-cdk-lib/aws-mediapackagev2";
import { aws_iam as iam } from "aws-cdk-lib";
import { Construct } from "constructs";
import { NagSuppressions } from "cdk-nag";

/**
 * Props for the InferenceMediaPackage construct.
 */
export interface InferenceMediaPackageProps {
  /** Name for the MediaPackageV2 channel group */
  channelGroupName: string;
  /** Base name for channels — suffixed with -H and -V */
  channelBaseName: string;
  /** Optional resource tags */
  tags?: Record<string, string>;
}

/**
 * Encapsulates a MediaPackageV2 channel group with two channels (horizontal
 * and vertical) and an HLS origin endpoint on each channel.
 *
 * Follows LEF's MediaPackageV2 construct pattern — uses addDependency to
 * ensure channels depend on the channel group, and endpoints depend on
 * their respective channels.
 */
export class InferenceMediaPackage extends Construct {
  /** The channel group name */
  public readonly channelGroupName: string;
  /** The horizontal channel name (suffix -H) */
  public readonly horizontalChannelName: string;
  /** The vertical channel name (suffix -V) */
  public readonly verticalChannelName: string;
  /** Origin endpoint URL for the horizontal channel */
  public readonly horizontalEndpointUrl: string;
  /** Origin endpoint URL for the vertical channel */
  public readonly verticalEndpointUrl: string;

  private readonly hChannel: CfnChannel;
  private readonly vChannel: CfnChannel;
  private readonly hEndpoint: CfnOriginEndpoint;
  private readonly vEndpoint: CfnOriginEndpoint;

  constructor(scope: Construct, id: string, props: InferenceMediaPackageProps) {
    super(scope, id);

    this.channelGroupName = props.channelGroupName;
    this.horizontalChannelName = `${props.channelBaseName}-H`;
    this.verticalChannelName = `${props.channelBaseName}-V`;

    // Channel Group
    const channelGroup = new CfnChannelGroup(this, "ChannelGroup", {
      channelGroupName: this.channelGroupName,
      tags: props.tags
        ? Object.entries(props.tags).map(([key, value]) => ({ key, value }))
        : undefined,
    });

    // Horizontal channel
    this.hChannel = new CfnChannel(this, "ChannelH", {
      channelGroupName: this.channelGroupName,
      channelName: this.horizontalChannelName,
      inputType: "CMAF",
      tags: props.tags
        ? Object.entries(props.tags).map(([key, value]) => ({ key, value }))
        : undefined,
    });
    this.hChannel.addDependency(channelGroup);

    // Vertical channel
    this.vChannel = new CfnChannel(this, "ChannelV", {
      channelGroupName: this.channelGroupName,
      channelName: this.verticalChannelName,
      inputType: "CMAF",
      tags: props.tags
        ? Object.entries(props.tags).map(([key, value]) => ({ key, value }))
        : undefined,
    });
    this.vChannel.addDependency(channelGroup);

    // Origin endpoint for horizontal channel
    this.hEndpoint = new CfnOriginEndpoint(this, "EndpointH", {
      channelGroupName: this.channelGroupName,
      channelName: this.horizontalChannelName,
      originEndpointName: `ORIGIN-${this.horizontalChannelName}`,
      containerType: "CMAF",
      hlsManifests: [
        {
          manifestName: "index",
          childManifestName: "variant",
          manifestWindowSeconds: 30,
          programDateTimeIntervalSeconds: 1,
          scteHls: {
            adMarkerHls: "DATERANGE",
          },
        },
      ],
      segment: {
        segmentName: "segment",
        segmentDurationSeconds: 2,
        includeIframeOnlyStreams: false,
        scte: {
          scteFilter: ["SPLICE_INSERT"],
        },
      },
      tags: props.tags
        ? Object.entries(props.tags).map(([key, value]) => ({ key, value }))
        : undefined,
    });
    this.hEndpoint.addDependency(this.hChannel);

    // Origin endpoint for vertical channel
    this.vEndpoint = new CfnOriginEndpoint(this, "EndpointV", {
      channelGroupName: this.channelGroupName,
      channelName: this.verticalChannelName,
      originEndpointName: `ORIGIN-${this.verticalChannelName}`,
      containerType: "CMAF",
      hlsManifests: [
        {
          manifestName: "index",
          childManifestName: "variant",
          manifestWindowSeconds: 30,
          programDateTimeIntervalSeconds: 1,
          scteHls: {
            adMarkerHls: "DATERANGE",
          },
        },
      ],
      segment: {
        segmentName: "segment",
        segmentDurationSeconds: 2,
        includeIframeOnlyStreams: false,
        scte: {
          scteFilter: ["SPLICE_INSERT"],
        },
      },
      tags: props.tags
        ? Object.entries(props.tags).map(([key, value]) => ({ key, value }))
        : undefined,
    });
    this.vEndpoint.addDependency(this.vChannel);

    // Expose origin endpoint URLs
    this.horizontalEndpointUrl = Fn.select(0, this.hEndpoint.attrHlsManifestUrls);
    this.verticalEndpointUrl = Fn.select(0, this.vEndpoint.attrHlsManifestUrls);

    new CfnOutput(this, "HorizontalEndpointUrl", {
      value: this.horizontalEndpointUrl,
      description: "Origin endpoint URL for horizontal channel",
    });

    new CfnOutput(this, "VerticalEndpointUrl", {
      value: this.verticalEndpointUrl,
      description: "Origin endpoint URL for vertical channel",
    });
  }

  /**
   * Attach channel policies (allow MediaLive to PutObject) and origin endpoint
   * policies (allow public GetObject for playback). Must be called after the
   * MediaLive IAM role is created.
   *
   * Follows LEF's MediaPackageV2 construct pattern.
   */
  attachPolicies(mediaLiveRoleArn: string) {
    // Channel policy — allow MediaLive role to push to horizontal channel
    const hChannelPolicy = new CfnChannelPolicy(this, "ChannelPolicyH", {
      channelName: this.horizontalChannelName,
      channelGroupName: this.channelGroupName,
      policy: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            sid: "AllowMediaLivePush",
            effect: iam.Effect.ALLOW,
            actions: ["mediapackagev2:PutObject"],
            principals: [new iam.ArnPrincipal(mediaLiveRoleArn)],
            resources: [this.hChannel.attrArn],
          }),
        ],
      }),
    });
    hChannelPolicy.addDependency(this.hChannel);

    // Channel policy — allow MediaLive role to push to vertical channel
    const vChannelPolicy = new CfnChannelPolicy(this, "ChannelPolicyV", {
      channelName: this.verticalChannelName,
      channelGroupName: this.channelGroupName,
      policy: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            sid: "AllowMediaLivePush",
            effect: iam.Effect.ALLOW,
            actions: ["mediapackagev2:PutObject"],
            principals: [new iam.ArnPrincipal(mediaLiveRoleArn)],
            resources: [this.vChannel.attrArn],
          }),
        ],
      }),
    });
    vChannelPolicy.addDependency(this.vChannel);

    // Origin endpoint policy — allow public access for playback (reference architecture sample)
    const hEndpointPolicy = new CfnOriginEndpointPolicy(this, "EndpointPolicyH", {
      channelName: this.horizontalChannelName,
      channelGroupName: this.channelGroupName,
      originEndpointName: this.hEndpoint.originEndpointName,
      policy: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            sid: "AllowPublicRead",
            effect: iam.Effect.ALLOW,
            actions: ["mediapackagev2:GetObject", "mediapackagev2:GetHeadObject"],
            principals: [new iam.AnyPrincipal()],
            resources: [this.hEndpoint.attrArn],
          }),
        ],
      }),
    });
    hEndpointPolicy.addDependency(this.hEndpoint);

    const vEndpointPolicy = new CfnOriginEndpointPolicy(this, "EndpointPolicyV", {
      channelName: this.verticalChannelName,
      channelGroupName: this.channelGroupName,
      originEndpointName: this.vEndpoint.originEndpointName,
      policy: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            sid: "AllowPublicRead",
            effect: iam.Effect.ALLOW,
            actions: ["mediapackagev2:GetObject", "mediapackagev2:GetHeadObject"],
            principals: [new iam.AnyPrincipal()],
            resources: [this.vEndpoint.attrArn],
          }),
        ],
      }),
    });
    vEndpointPolicy.addDependency(this.vEndpoint);

    // Suppress cdk-nag for public endpoint policy — reference architecture sample
    NagSuppressions.addResourceSuppressions(
      [hEndpointPolicy, vEndpointPolicy],
      [
        {
          id: "AwsSolutions-IAM5",
          reason: "Public endpoint policy used for reference architecture sample — production should use CloudFront OAC.",
        },
      ],
      true,
    );
  }
}
