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
import { IMediaLiveConfig } from './eventConfigInterface';

let defaultAudioInputAlreadyCreated: boolean = false;

export interface IMediaLiveProps {
  channelName: string;
  mediaLiveAccessRoleArn: string;
  configuration: IMediaLiveConfig;
  hlsIngestEndpoint1?: string;
  hlsIngestEndpoint2?: string;
}

export class MediaLive extends Construct {
  public readonly channelLive: medialive.CfnChannel;
  public readonly channelInput: medialive.CfnInput;

  constructor(scope: Construct, id: string, props: IMediaLiveProps) {
    super(scope, id);

    // Set some props values to local variables
    const configuration = props.configuration;
    const mediaLiveAccessRoleArn = props.mediaLiveAccessRoleArn;

    var destinationValue = [];
    let inputSettingsValue: any = {
      sourceEndBehavior: "CONTINUE",
    };

    /*
     * Second step: Create Security Groups
     */
    // Generate Security Groups for RTP and RTMP (Push) inputs
    const mediaLiveSG = new medialive.CfnInputSecurityGroup(
      this,
      "MediaLiveInputSecurityGroup",
      {
        whitelistRules: [
          {
            cidr: configuration.inputCidr,
          },
        ],
      },
    );

    /*
     * Third step: Create Input and specific info based on the input types
     */
    // 1. Create a MediaLive input
    const inputName =
      Aws.STACK_NAME + "_" + configuration.inputType + "_MediaLiveInput";
    var cfnInputProps: medialive.CfnInputProps = {
      name: "",
      roleArn: "",
      type: "",
      inputSecurityGroups: [],
      destinations: [
        {
          streamName: "",
        },
      ],
      inputDevices: [
        {
          id: "",
        },
      ],
      mediaConnectFlows: [
        {
          flowArn: "",
        },
      ],
      sources: [
        {
          passwordParam: "passwordParam",
          url: "url",
          username: "username",
        },
      ],
      vpc: {
        securityGroupIds: [""],
        subnetIds: [""],
      },
    };

    // 1.1 Testing the Input Type
    switch (configuration.inputType) {
      case "INPUT_DEVICE":
        // Validating if STANDARD or SINGLE_PIPELINE Channel to provide 1 or 2 InputDevice
        if (configuration.channelClass == "STANDARD") {
          destinationValue = [
            { id: configuration.priLink },
            { id: configuration.secLink },
          ];
        } else {
          destinationValue = [{ id: configuration.priLink }];
        }
        cfnInputProps = {
          name: inputName,
          type: configuration.inputType,
          inputDevices: destinationValue,
        };
        break;

      case "RTP_PUSH":
        cfnInputProps = {
          name: inputName,
          type: configuration.inputType,
          inputSecurityGroups: [mediaLiveSG.ref],
        };
        break;
      case "RTMP_PUSH":
        // Validating if STANDARD or SINGLE_PIPELINE Channel to provide 1 or 2 URL
        if (configuration.channelClass == "STANDARD") {
          destinationValue = [
            { streamName: configuration.rtmpStreamName + "/primary" },
            { streamName: configuration.rtmpStreamName + "/secondary" },
          ];
        } else {
          destinationValue = [
            { streamName: configuration.rtmpStreamName + "/primary" },
          ];
        }
        cfnInputProps = {
          name: inputName,
          type: configuration.inputType,
          inputSecurityGroups: [mediaLiveSG.ref],
          destinations: destinationValue,
        };
        break;
      case "URL_PULL":
        // HLS Input Attachments require additional parameters to be set
        // MediaLive can extract SCTE markers from either the HLS Manifests or Segments.
        // By default SCTE markers are read from segments. For this project the default m3u8
        // is generated using MediaTailor Channel assembly and the SCTE need to be read from
        // the manifest files.
        if (configuration.priUrl.endsWith(".m3u8")) {
          inputSettingsValue = {
            sourceEndBehavior: configuration.sourceEndBehavior,
            networkInputSettings: {
              hlsInputSettings: {
                scte35Source: "MANIFEST",
              },
            },
          };
        }
      // Code is intended to fall throught to the same processing for 'TS_FILE'
      case "MP4_FILE":
      case "RTMP_PULL":
      case "TS_FILE":
        // Validating if STANDARD or SINGLE_PIPELINE Channel to provide 1 or 2 URL
        if (configuration.channelClass == "STANDARD") {
          destinationValue = [
            { url: configuration.priUrl },
            { url: configuration.secUrl },
          ];
        } else {
          destinationValue = [{ url: configuration.priUrl }];
        }
        cfnInputProps = {
          name: inputName,
          type: configuration.inputType,
          sources: destinationValue,
        };
        inputSettingsValue["sourceEndBehavior"] =
          configuration.sourceEndBehavior;
        break;
      case "MEDIACONNECT":
        // Validating if STANDARD or SINGLE_PIPELINE Channel to provide 1 or 2 URL
        if (configuration.channelClass == "STANDARD") {
          destinationValue = [
            { flowArn: configuration.priFlow },
            { flowArn: configuration.secFlow },
          ];
        } else {
          destinationValue = [{ flowArn: configuration.priFlow }];
        }
        cfnInputProps = {
          name: inputName,
          type: configuration.inputType,
          roleArn: mediaLiveAccessRoleArn,
          mediaConnectFlows: destinationValue,
        };
        break;
    }

    const mediaLiveInput = new medialive.CfnInput(
      this,
      "MediaInputChannel",
      cfnInputProps,
    );

    //2. Create Channel
    var encoderSettings = require(configuration.encodingProfileLocation);

    // HLS Output Group
    // Validating if STANDARD or SINGLE_PIPELINE Channel to provide 1 or 2 URL for MediaPackage Ingest
    var mediaLiveDestination = {};
    if (configuration.channelClass == "STANDARD") {
      mediaLiveDestination = {
        id: "media-destination",
        settings: [
          {
            url: props.hlsIngestEndpoint1,
          },
          {
            url: props.hlsIngestEndpoint2,
          },
        ],
      };
    } else {
      mediaLiveDestination = {
        id: "media-destination",
        settings: [
          {
            url: props.hlsIngestEndpoint1,
          },
        ],
      };
    }

    // Format adMarkers into structure required by MediaLive
    const adMarkers: Array<string> = [];
    if ( configuration.adMarkers !== undefined && configuration.adMarkers !== "" ) {
      adMarkers.push( configuration.adMarkers )
    }

    // Configure output group settings
    encoderSettings.outputGroups[0].outputGroupSettings = {
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
        segmentLength: configuration.segmentLengthInSeconds,
        minSegmentLength: configuration.minimumSegmentLengthInSeconds,
        programDateTime: "INCLUDE",
        programDateTimeClock: "SYSTEM_CLOCK",
        programDateTimePeriod: configuration.segmentLengthInSeconds,
      },
    };

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
            scte35Behavior: configuration.scte35Behavior,
            scte35Pid: "500",
          },
        },
      },
    };

    var commonAudioOutputSettings = {
      audioOnlyHlsSettings: {
        audioGroupId: "program_audio",
        audioTrackType: "ALTERNATE_AUDIO_AUTO_SELECT_DEFAULT",
        segmentType: "AAC",
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

    const channelLive = new medialive.CfnChannel(this, "MediaLiveChannel", {
      channelClass: configuration.channelClass,
      destinations: [
        mediaLiveDestination as medialive.CfnChannel.OutputDestinationProperty,
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
          inputAttachmentName: inputName,
          inputSettings: inputSettingsValue,
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
      ["UDP_PUSH", "RTP_PUSH", "RTMP_PUSH"].includes(configuration.inputType)
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
