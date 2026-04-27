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
} from "aws-cdk-lib/aws-mediapackagev2";
import { Construct } from "constructs";

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
    const hChannel = new CfnChannel(this, "ChannelH", {
      channelGroupName: this.channelGroupName,
      channelName: this.horizontalChannelName,
      inputType: "CMAF",
      tags: props.tags
        ? Object.entries(props.tags).map(([key, value]) => ({ key, value }))
        : undefined,
    });
    hChannel.addDependency(channelGroup);

    // Vertical channel
    const vChannel = new CfnChannel(this, "ChannelV", {
      channelGroupName: this.channelGroupName,
      channelName: this.verticalChannelName,
      inputType: "CMAF",
      tags: props.tags
        ? Object.entries(props.tags).map(([key, value]) => ({ key, value }))
        : undefined,
    });
    vChannel.addDependency(channelGroup);

    // Origin endpoint for horizontal channel
    const hEndpoint = new CfnOriginEndpoint(this, "EndpointH", {
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
    hEndpoint.addDependency(hChannel);

    // Origin endpoint for vertical channel
    const vEndpoint = new CfnOriginEndpoint(this, "EndpointV", {
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
    vEndpoint.addDependency(vChannel);

    // Expose origin endpoint URLs (first HLS manifest URL from each endpoint)
    this.horizontalEndpointUrl = Fn.select(0, hEndpoint.attrHlsManifestUrls);
    this.verticalEndpointUrl = Fn.select(0, vEndpoint.attrHlsManifestUrls);

    new CfnOutput(this, "HorizontalEndpointUrl", {
      value: this.horizontalEndpointUrl,
      description: "Origin endpoint URL for horizontal channel",
    });

    new CfnOutput(this, "VerticalEndpointUrl", {
      value: this.verticalEndpointUrl,
      description: "Origin endpoint URL for vertical channel",
    });
  }
}
