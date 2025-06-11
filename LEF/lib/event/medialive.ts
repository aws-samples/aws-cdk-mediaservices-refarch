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

import { aws_medialive as medialive, Aws, CfnOutput, Fn } from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  IMediaLiveConfig,
  MediaLiveChannelClass,
} from "./eventConfigInterface";
import { MediaLiveInput } from "./inputs/mediaLiveInputTypes";

let defaultAudioInputAlreadyCreated: boolean = false;

export interface IMediaLiveProps {
  channelName: string;
  mediaLiveAccessRoleArn: string;
  configuration: IMediaLiveConfig;
  outputGroupType: string;
  hlsIngestEndpoint1: string;
  hlsIngestEndpoint2: string;
}

interface MediaLiveDestinationSetting {
  url: string;
}

export class MediaLive extends Construct {
  public readonly channelLive: medialive.CfnChannel;
  public readonly channelInput: medialive.CfnInput;

  private configuration: IMediaLiveConfig;

  private createInputProps(
    inputName: string,
    input: MediaLiveInput,
    mediaLiveAccessRole: string,
  ): medialive.CfnInputProps {
    const baseProps: Partial<medialive.CfnInputProps> = {
      name: inputName,
    };

    switch (input.type) {
      case "MULTICAST":
        return {
          ...baseProps,
          type: "MULTICAST",
          multicastSettings: input.multicastSettings,
        };

      case "INPUT_DEVICE":
        return {
          ...baseProps,
          type: "INPUT_DEVICE",
          inputDevices: [{ id: input.deviceId }],
        };

      case "RTP_PUSH":
        return {
          ...baseProps,
          type: "RTP_PUSH",
          inputSecurityGroups: [this.createMediaLiveSecurityGroup(input.cidr)],
        };

      case "RTMP_PUSH":
        return {
          ...baseProps,
          type: "RTMP_PUSH",
          inputSecurityGroups: [this.createMediaLiveSecurityGroup(input.cidr)],
        };

      case "RTMP_PULL":
        return {
          ...baseProps,
          type: "RTMP_PULL",
          sources: input.urls.map((url: string) => ({
            url: url,
            ...(input.username && input.password
              ? {
                  username: input.username,
                  passwordParam: input.password,
                }
              : {}),
          })),
        };

      case "MEDIACONNECT":
        return {
          ...baseProps,
          type: "MEDIACONNECT",
          roleArn: mediaLiveAccessRole,
          mediaConnectFlows: input.arnList.map((arn: string) => ({
            flowArn: arn,
          })),
        };

      case "URL_PULL":
        return {
          ...baseProps,
          type: "URL_PULL",
          sources: input.urls.map(
            (urlConfig: {
              url: string;
              username?: string;
              password?: string;
            }): medialive.CfnInput.InputSourceRequestProperty => ({
              url: urlConfig.url,
              ...(urlConfig.username && { username: urlConfig.username }),
              ...(urlConfig.password && { passwordParam: urlConfig.password }),
            }),
          ),
        };

      case "MP4_FILE":
      case "TS_FILE":
        return {
          ...baseProps,
          type: input.type,
          sources: input.urls.map((url: string) => {
            return {
              url: url,
            };
          }),
        };
    }

    throw new Error(
      "Unknown input type. Specified input type does not match a supported type",
    );
  }

  private getAttachedInputSettings(): any {
    const input = this.configuration.input;

    if (input.type == "URL_PULL" && input.urls[0].url.endsWith(".m3u8")) {
      // HLS Input Attachments require additional parameters to be set
      // MediaLive can extract SCTE markers from either the HLS Manifests or Segments.
      // By default SCTE markers are read from segments. For this project the default m3u8
      // is generated using MediaTailor Channel assembly and the SCTE need to be read from
      // the manifest files.
      return {
        sourceEndBehavior: this.configuration.sourceEndBehavior,
        networkInputSettings: {
          hlsInputSettings: {
            scte35Source: "MANIFEST",
          },
        },
      };
    } else if (
      [
        "MEDIACONNECT",
        "RTP_PUSH",
        "MULTICAST",
        "INPUT_DEVICE",
        "RTP_PUSH",
        "RTMP_PUSH",
        "RTMP_PULL",
      ].includes(input.type)
    ) {
      // Listed inputs do not support 'LOOP' sourceEndBehaviour
      return {
        sourceEndBehavior: "CONTINUE",
      };
    }
    return {
      sourceEndBehavior: this.configuration.sourceEndBehavior,
    };
  }

  private getMediaLiveDestination(
    channelClass: MediaLiveChannelClass,
    pipeline0Destination: string,
    pipeline1Destination: string,
  ): medialive.CfnChannel.OutputDestinationProperty {
    // Validating if STANDARD or SINGLE_PIPELINE Channel to provide 1 or 2 URL for MediaPackage Ingest
    let destination = {
      id: "media-destination",
      settings: [] as MediaLiveDestinationSetting[],
    };

    if (channelClass === "SINGLE_PIPELINE") {
      destination.settings = [{ url: pipeline0Destination }];
    } else {
      destination.settings = [
        { url: pipeline0Destination },
        { url: pipeline1Destination },
      ];
    }
    return destination as medialive.CfnChannel.OutputDestinationProperty;
  }

  private getOutputGroupSettings(outputGroupType: string): any {
    let outputGroupSettings: any = {};

    // Configure output group settings
    if (outputGroupType == "CMAF") {
      // Configure CMAF Output Group
      outputGroupSettings = {
        cmafIngestGroupSettings: {
          destination: {
            destinationRefId: "media-destination",
          },
          nielsenId3Behavior: "NO_PASSTHROUGH",
          scte35Type: "SCTE_35_WITHOUT_SEGMENTATION",
          segmentLength: this.configuration.segmentLengthInSeconds,
          segmentLengthUnits: "SECONDS",
        },
      };
    } else if (outputGroupType == "HLS") {
      // Format adMarkers into structure required by MediaLive
      const adMarkers: Array<string> = [];
      if (
        this.configuration.adMarkers !== undefined &&
        this.configuration.adMarkers !== ""
      ) {
        adMarkers.push(this.configuration.adMarkers);
      }
      // Configure HLS Output Group
      outputGroupSettings = {
        hlsGroupSettings: {
          adMarkers: adMarkers,
          destination: {
            destinationRefId: "media-destination",
          },
          hlsCdnSettings: {
            hlsBasicPutSettings: {
              connectionRetryInterval: 1,
              filecacheDuration: 300,
              numRetries: 10,
              restartDelay: 15,
            },
          },
          hlsId3SegmentTagging: "ENABLED",
          inputLossAction: "PAUSE_OUTPUT",
          segmentLength: this.configuration.segmentLengthInSeconds,
          minSegmentLength: this.configuration.minimumSegmentLengthInSeconds,
          programDateTime: "INCLUDE",
          programDateTimeClock: "SYSTEM_CLOCK",
          programDateTimePeriod: this.configuration.segmentLengthInSeconds,
        },
      };
    } else {
      throw new Error("Unknown and unsupported output group type.");
    }

    return outputGroupSettings;
  }

  private setHlsOutputGroupSpecificSettings(encoderSettings: any) {
    // Method to isolate the configuration only required for a HLS output group

    // Get a list of all the audio codecs used in the profile
    // An audio rendition group will be created for each audio codec
    const audioRenditionSets = getAudioRenditionSets(
      encoderSettings.audioDescriptions,
    );

    var commonVideoOutputSettings = {
      hlsSettings: {
        standardHlsSettings: {
          audioRenditionSets: audioRenditionSets,
          m3U8Settings: {
            scte35Behavior: this.configuration.scte35Behavior,
            scte35Pid: "500",
          },
        },
      },
    };

    var frameCaptureOutputSettings = {
      hlsSettings: {
        frameCaptureHlsSettings: {},
      },
    };

    var videoDescriptions = encoderSettings.videoDescriptions;

    // Set output settings for each output in the output group
    for (var output of encoderSettings.outputGroups[0].outputs) {
      // Set default blank output settings for the output
      output.outputSettings = { hlsOutputSettings: {} };

      if (output.videoDescriptionName) {
        // Process as a video rendition
        var videoDescription = getVideoDescriptionByName(
          videoDescriptions,
          output.videoDescriptionName,
        );

        if (
          videoDescription &&
          videoDescription.codecSettings &&
          videoDescription.codecSettings.frameCaptureSettings
        ) {
          // Frame capture video descriptions require a different set of output settings
          output.outputSettings.hlsOutputSettings = frameCaptureOutputSettings;
        } else {
          output.outputSettings.hlsOutputSettings = commonVideoOutputSettings;
        }
      } else if (output.audioDescriptionNames) {
        // Process as an audio rendition
        output.outputSettings.hlsOutputSettings.hlsSettings =
          getHlsAudioOutputSettings(output, encoderSettings.audioDescriptions);
      } else if (output.captionDescriptionNames) {
        // Process as an captions rendition
        output.outputSettings.hlsOutputSettings = commonVideoOutputSettings;
      } else {
        throw new Error("Unknown and unsupported output type.");
      }
    }
  }

  constructor(scope: Construct, id: string, props: IMediaLiveProps) {
    super(scope, id);

    const { configuration, mediaLiveAccessRoleArn } = props;
    this.configuration = configuration;

    //1. Create the MediaLive Input
    const inputName =
      configuration.input.inputName ||
      `${Aws.STACK_NAME}_${configuration.input.type}_MediaLiveInput`;
    const mediaLiveInput = new medialive.CfnInput(
      this,
      "MediaInputChannel",
      this.createInputProps(
        inputName,
        configuration.input,
        mediaLiveAccessRoleArn,
      ),
    );
    const attachedInputSettings = this.getAttachedInputSettings();

    //2. Create Channel
    // Load MediaLive Output settins from configurations file
    var encoderSettings = require(configuration.encodingProfileLocation);
    // Configure output group settings
    encoderSettings.outputGroups[0].outputGroupSettings =
      this.getOutputGroupSettings(props.outputGroupType);

    if (props.outputGroupType == "HLS") {
      // Set unique output configuration required for HLS output groups
      // CMAF Output groups require significantly less configuration
      this.setHlsOutputGroupSpecificSettings(encoderSettings);
    }

    // Set additional MediaLive Anywhere configuration if specified
    var anywhereSettings:
      | medialive.CfnChannel.AnywhereSettingsProperty
      | undefined = configuration.anywhereSettings;

    const channelLive = new medialive.CfnChannel(this, "MediaLiveChannel", {
      channelClass: configuration.channelClass,
      anywhereSettings: anywhereSettings,
      destinations: [
        this.getMediaLiveDestination(
          configuration.channelClass,
          props.hlsIngestEndpoint1,
          props.hlsIngestEndpoint2,
        ),
      ],
      inputSpecification: {
        codec: configuration.inputSpecification.codec,
        resolution: configuration.inputSpecification.resolution,
        maximumBitrate: configuration.inputSpecification.maximumBitrate,
      },
      name: props.channelName,
      roleArn: mediaLiveAccessRoleArn,
      inputAttachments: [
        {
          inputId: mediaLiveInput.ref,
          inputAttachmentName: mediaLiveInput.name,
          inputSettings: attachedInputSettings,
        },
      ],
      encoderSettings:
        encoderSettings as medialive.CfnChannel.EncoderSettingsProperty,
    });

    this.channelLive = channelLive;
    this.channelInput = mediaLiveInput;
    /*
     * Final step: Exporting Varibales for Cfn Outputs 👇
     */
    new CfnOutput(this, "MediaLiveChannelArn", {
      value: this.channelLive.attrArn,
      exportName: Aws.STACK_NAME + "mediaLiveChannelArn",
      description: "The Arn of the MediaLive Channel",
    });
    new CfnOutput(this, "MediaLiveChannelInputName", {
      value: inputName,
      exportName: Aws.STACK_NAME + "mediaLiveChannelInputName",
      description: "The Input Name of the MediaLive Channel",
    });
    if (
      ["UDP_PUSH", "RTP_PUSH", "RTMP_PUSH"].includes(configuration.input.type)
    ) {
      if (configuration.channelClass == "STANDARD") {
        new CfnOutput(this, "MediaLiveChannelDestPri", {
          value: Fn.join("", [
            Fn.select(0, this.channelInput.attrDestinations),
          ]),
          exportName: Aws.STACK_NAME + "mediaLiveChannelDestPri",
          description: "Primary MediaLive input Url",
        });
        new CfnOutput(this, "MediaLiveChannelDestSec", {
          value: Fn.join("", [
            Fn.select(1, this.channelInput.attrDestinations),
          ]),
          exportName: Aws.STACK_NAME + "mediaLiveChannelDestSec",
          description: "Seconday MediaLive input Url",
        });
      } else {
        new CfnOutput(this, "MediaLiveChannelDestPri", {
          value: Fn.join("", [
            Fn.select(0, this.channelInput.attrDestinations),
          ]),
          exportName: Aws.STACK_NAME + "mediaLiveChannelDestPri",
          description: "Primary MediaLive input Url",
        });
      }
    }
  }

  // Function to create a Security Group
  createMediaLiveSecurityGroup(inputCidr: string[]): string {
    // Create list of cidr blocks
    const cidrList = inputCidr.map((cidr) => {
      return { cidr: cidr };
    });

    const mediaLiveSG = new medialive.CfnInputSecurityGroup(
      this,
      "MediaLiveInputSecurityGroup",
      {
        whitelistRules: cidrList,
      },
    );
    return mediaLiveSG.ref;
  }
}

function getVideoDescriptionByName(videoDescriptions: any, name: string) {
  // Return the videoDecription from the videoDescriptions array that matches the name
  for (let i = 0; i < videoDescriptions.length; i++) {
    if (videoDescriptions[i].name === name) {
      return videoDescriptions[i];
    }
  }
}

function getAudioRenditionSets(audioDescriptions: any) {
  // define and empty list of strings call audioRenditionSets
  let audioRenditionSets: string[] = [];

  // Iterate over all audio descriptions
  for (let i = 0; i < audioDescriptions.length; i++) {
    let codecString = getAudoCodecFromAudioDescription(audioDescriptions[i]);

    // If codecSettings exists in audioRenditionSets
    // don't add it again
    if (audioRenditionSets.includes(codecString)) {
      continue;
    }

    // append codecSettings to audioRenditionSets
    audioRenditionSets.push(codecString);
  }

  // create a comma separated string of audioRenditionSets
  let audioRenditionSetsString = audioRenditionSets.join(",");

  return audioRenditionSetsString;
}

function getAudoCodecFromAudioDescription(audioDescription: any) {
  // Gett the codec settings string
  let codecSettings = Object.keys(audioDescription.codecSettings)[0];

  // Strip 'Settings' from the end of codecSettings
  codecSettings = codecSettings.replace("Settings", "");

  return codecSettings;
}

// Returns the configuration for the audio output settings.
// A new audio group is created for each audio codec.
// The first audio track listed in the configuration file determines which audio
// group is listed as the default.
function getHlsAudioOutputSettings(output: any, audioDescriptions: any) {
  // Get the list of audio description names from the output
  let audioDescriptionNames = output.audioDescriptionNames;

  // Throw an error is there is more than one audio description name
  if (audioDescriptionNames.length > 1) {
    throw new Error(
      "More than one audio description name is not supported in this class.",
    );
  }

  // Get the audio description name from the list
  let audioDescriptionName = audioDescriptionNames[0];

  // Find the audioDescription in audiodDescriptions where Name is equal to audioDescriptionName
  let audioDescription = audioDescriptions.find(function (
    audioDescription: any,
  ) {
    return audioDescription.name === audioDescriptionName;
  });

  let codecString = getAudoCodecFromAudioDescription(audioDescription);

  // If the default audio rendition has not been created make it the default
  // otherwise just make the rendition an auto select
  let audioTrackType = "ALTERNATE_AUDIO_AUTO_SELECT";
  if (defaultAudioInputAlreadyCreated == false) {
    audioTrackType = "ALTERNATE_AUDIO_AUTO_SELECT_DEFAULT";
    defaultAudioInputAlreadyCreated = true;
  }

  return {
    audioOnlyHlsSettings: {
      audioGroupId: codecString,
      audioTrackType: audioTrackType,
      segmentType: "AAC",
    },
  };
}
