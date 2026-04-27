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

import { aws_medialive as medialive } from "aws-cdk-lib";
import { Construct } from "constructs";
import { IVideoConfig, IVideoRendition } from "../configInterface";

/**
 * Props for the InferenceMediaLive construct.
 */
export interface InferenceMediaLiveProps {
  /** Channel display name */
  channelName: string;
  /** MediaLive IAM role ARN */
  roleArn: string;
  /** Elemental Inference Feed ARN for InferenceSettings */
  feedArn: string;
  /** MediaLive CfnInput ref (ID) for the input attachment */
  inputId: string;
  /** MediaPackageV2 horizontal channel reference */
  horizontalChannel: { channelGroupName: string; channelName: string };
  /** MediaPackageV2 vertical channel reference */
  verticalChannel: { channelGroupName: string; channelName: string };
  /** Video encoding configuration for horizontal and vertical ABR ladders */
  videoConfig: IVideoConfig;
  /** Optional resource tags */
  tags?: Record<string, string>;
}

/**
 * Build H.264 codec settings from a video rendition config.
 * Matches the deployed NAB26 baseline channel encoder profile.
 */
function buildH264Settings(rendition: IVideoRendition): medialive.CfnChannel.H264SettingsProperty {
  return {
    adaptiveQuantization: "AUTO",
    afdSignaling: "NONE",
    colorMetadata: "INSERT",
    entropyEncoding: "CABAC",
    flickerAq: "ENABLED",
    forceFieldPictures: "DISABLED",
    framerateControl: "SPECIFIED",
    framerateDenominator: 1,
    framerateNumerator: 30,
    gopBReference: rendition.height >= 720 ? "ENABLED" : "DISABLED",
    gopClosedCadence: 1,
    gopNumBFrames: 2,
    gopSize: 2.0,
    gopSizeUnits: "SECONDS",
    level: "H264_LEVEL_AUTO",
    lookAheadRateControl: "MEDIUM",
    maxBitrate: rendition.maxBitrate,
    numRefFrames: 1,
    parControl: "SPECIFIED",
    parDenominator: 1,
    parNumerator: 1,
    profile: rendition.height >= 720 ? "HIGH" : "MAIN",
    qualityLevel: "ENHANCED_QUALITY",
    rateControlMode: "QVBR",
    qvbrQualityLevel: rendition.qvbrQualityLevel,
    scanType: "PROGRESSIVE",
    sceneChangeDetect: "ENABLED",
    spatialAq: "ENABLED",
    subgopLength: "FIXED",
    syntax: "DEFAULT",
    temporalAq: "ENABLED",
    timecodeInsertion: "DISABLED",
  };
}

/**
 * Encapsulates a MediaLive channel with Elemental Inference integration.
 *
 * Creates a SINGLE_PIPELINE CfnChannel with:
 * - InferenceSettings linking to an Elemental Inference Feed
 * - Horizontal video descriptions (DEFAULT scaling) + vertical (SMART_CROP)
 * - Two HLS-CMAF output groups targeting MediaPackageV2 channels
 * - Two AAC audio descriptions (one per output group)
 */
export class InferenceMediaLive extends Construct {
  /** The underlying CfnChannel resource */
  public readonly channel: medialive.CfnChannel;

  constructor(scope: Construct, id: string, props: InferenceMediaLiveProps) {
    super(scope, id);

    // Build video descriptions from config
    const videoDescriptions: medialive.CfnChannel.VideoDescriptionProperty[] = [
      ...props.videoConfig.horizontal.map((r) => buildVideoDescription(r, "DEFAULT")),
      ...props.videoConfig.vertical.map((r) => buildVideoDescription(r, "SMART_CROP")),
    ];

    // Two AAC audio descriptions — one per output group
    const audioDescriptions: medialive.CfnChannel.AudioDescriptionProperty[] = [
      buildAacAudioDescription("Audio-AAC"),
      buildAacAudioDescription("vAudio-AAC"),
    ];

    // Horizontal output group
    const horizontalOutputGroup: medialive.CfnChannel.OutputGroupProperty = {
      name: "HLS-CMAF-Horizontal",
      outputGroupSettings: {
        mediaPackageGroupSettings: {
          destination: { destinationRefId: "h-destination" },
        },
      },
      outputs: props.videoConfig.horizontal.map((r) => ({
        outputName: r.name,
        videoDescriptionName: r.name,
        audioDescriptionNames: ["Audio-AAC"],
        outputSettings: {
          mediaPackageOutputSettings: {},
        },
      })),
    };

    // Vertical output group
    const verticalOutputGroup: medialive.CfnChannel.OutputGroupProperty = {
      name: "HLS-CMAF-Vertical",
      outputGroupSettings: {
        mediaPackageGroupSettings: {
          destination: { destinationRefId: "v-destination" },
        },
      },
      outputs: props.videoConfig.vertical.map((r) => ({
        outputName: r.name,
        videoDescriptionName: r.name,
        audioDescriptionNames: ["vAudio-AAC"],
        outputSettings: {
          mediaPackageOutputSettings: {},
        },
      })),
    };

    // Destinations for MediaPackageV2
    const destinations: medialive.CfnChannel.OutputDestinationProperty[] = [
      {
        id: "h-destination",
        mediaPackageSettings: [
          {
            channelId: props.horizontalChannel.channelName,
          },
        ],
      },
      {
        id: "v-destination",
        mediaPackageSettings: [
          {
            channelId: props.verticalChannel.channelName,
          },
        ],
      },
    ];

    this.channel = new medialive.CfnChannel(this, "Channel", {
      name: props.channelName,
      channelClass: "SINGLE_PIPELINE",
      roleArn: props.roleArn,
      inferenceSettings: {
        feedArn: props.feedArn,
      },
      inputSpecification: {
        codec: "AVC",
        resolution: "HD",
        maximumBitrate: "MAX_20_MBPS",
      },
      inputAttachments: [
        {
          inputId: props.inputId,
          inputAttachmentName: `input-${props.inputId}`,
        },
      ],
      destinations,
      encoderSettings: {
        audioDescriptions,
        videoDescriptions,
        outputGroups: [horizontalOutputGroup, verticalOutputGroup],
        timecodeConfig: {
          source: "EMBEDDED",
        },
      },
      tags: props.tags,
    });
  }
}

function buildVideoDescription(
  rendition: IVideoRendition,
  scalingBehavior: "DEFAULT" | "SMART_CROP",
): medialive.CfnChannel.VideoDescriptionProperty {
  return {
    name: rendition.name,
    width: rendition.width,
    height: rendition.height,
    scalingBehavior,
    respondToAfd: "NONE",
    sharpness: 50,
    codecSettings: {
      h264Settings: buildH264Settings(rendition),
    },
  };
}

function buildAacAudioDescription(
  name: string,
): medialive.CfnChannel.AudioDescriptionProperty {
  return {
    name,
    audioSelectorName: "default",
    codecSettings: {
      aacSettings: {
        bitrate: 192000,
        codingMode: "CODING_MODE_2_0",
        profile: "LC",
        rateControlMode: "CBR",
        sampleRate: 48000,
      },
    },
  };
}
