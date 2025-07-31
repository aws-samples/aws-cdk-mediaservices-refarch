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
import * as fs from 'fs';
import { Construct } from "constructs";
import {
  IMediaLiveConfig,
  MediaLiveChannelClass,
} from "./eventConfigInterface";

export enum MediaLiveOutputGroupType {
  CMAF = "CMAF",
  HLS = "HLS", 
  MEDIAPACKAGE = "MEDIAPACKAGE"
}

interface BaseDestinationConfig {
  channelClass: MediaLiveChannelClass;
}

interface MediaPackageDestinationConfig extends BaseDestinationConfig {
  type: MediaLiveOutputGroupType.MEDIAPACKAGE;
  mediaPackage: {
    channelName: string;
    channelGroup: string;
  };
}

interface EndpointDestinationConfig extends BaseDestinationConfig {
  type: MediaLiveOutputGroupType.CMAF | MediaLiveOutputGroupType.HLS;
  endpoints: {
    primary: string;
    secondary: string;
  };
}

type DestinationConfig = MediaPackageDestinationConfig | EndpointDestinationConfig;

interface OutputDestinationSettings {
  url: string;
}

interface MediaPackageOutputDestinationSettings {
  channelName: string;
  channelGroup: string;
}
import { MediaLiveInput } from "./inputs/mediaLiveInputTypes";
import { TaggingUtils } from "../utils/tagging";

let defaultAudioInputAlreadyCreated: boolean = false;

export interface IMediaLiveProps {
  channelName: string;
  mediaLiveAccessRoleArn: string;
  configuration: IMediaLiveConfig;
  destinationConfig: DestinationConfig;
  tags: Record<string, string>[];
}

export class MediaLive extends Construct {
  public readonly channelLive: medialive.CfnChannel;
  public readonly channelInputs: medialive.CfnInput[];

  private configuration: IMediaLiveConfig;
  private outputConfig: DestinationConfig;

  private createInputProps(
    inputName: string,
    input: MediaLiveInput,
    mediaLiveAccessRole: string,
    tags: Record<string, string>[],
  ): medialive.CfnInputProps {
    const baseProps: Partial<medialive.CfnInputProps> = {
      name: inputName,
      tags: TaggingUtils.convertToMapTags(tags),
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

  private getAttachedInputSettings(input: MediaLiveInput): any {
    // Determine the sourceEndBehavior to use
    // First check if the input has sourceEndBehavior defined
    // If not, use "CONTINUE" as default
    const sourceEndBehavior = input.sourceEndBehavior ||
                             "CONTINUE";
    
    if (input.type == "URL_PULL" && input.urls[0].url.endsWith(".m3u8")) {
      // HLS Input Attachments require additional parameters to be set
      // MediaLive can extract SCTE markers from either the HLS Manifests or Segments.
      // By default SCTE markers are read from segments. For this project the default m3u8
      // is generated using MediaTailor Channel assembly and the SCTE need to be read from
      // the manifest files.
      
      // bufferSegments must be set to 10 or less for HLS inputs when multiple inputs are configured
      // This is required for Channel Schedule input switch actions
      const hasMultipleInputs = this.configuration.inputs.length > 1;
      
      return {
        sourceEndBehavior: sourceEndBehavior,
        networkInputSettings: {
          hlsInputSettings: {
            scte35Source: "MANIFEST",
            // Set bufferSegments to 3 when multiple inputs are configured to enable input switching
            // This prevents the "VOD HLS inputs are not permitted for Channel Schedule input switch actions" error
            // Increasing the bufferSegments will also increase stream latency
            // Note: Three is a conservative value for bufferSegments and will increase the stream latency. This
            // value can be set to 2 to lower latency. Where latency is important consider using another input format.
            ...(hasMultipleInputs ? { bufferSegments: 3 } : {})
          },
        },
        captionSelectors: this.configuration.captionSelectors,
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
      sourceEndBehavior: sourceEndBehavior,
      captionSelectors: this.configuration.captionSelectors,
    };
  }

  private createDestinationSettings(): medialive.CfnChannel.OutputDestinationProperty {
    const destinationFactory = {
      [MediaLiveOutputGroupType.MEDIAPACKAGE]: () => this.createMediaPackageDestination(),
      [MediaLiveOutputGroupType.CMAF]: () => this.createUrlDestination(),
      [MediaLiveOutputGroupType.HLS]: () => this.createUrlDestination()
    };

    const factory = destinationFactory[this.outputConfig.type];
    if (!factory) {
      throw new Error(`Unsupported output group type: ${this.outputConfig.type}`);
    }
    
    return factory();
  }

  private createMediaPackageDestination(): medialive.CfnChannel.OutputDestinationProperty {
    if (this.outputConfig.type !== MediaLiveOutputGroupType.MEDIAPACKAGE) {
      throw new Error("MediaPackage configuration is required for MEDIAPACKAGE output group type");
    }

    return {
      id: "media-destination",
      mediaPackageSettings: [{
        channelName: this.outputConfig.mediaPackage.channelName,
        channelGroup: this.outputConfig.mediaPackage.channelGroup
      }] as MediaPackageOutputDestinationSettings[],
    } as medialive.CfnChannel.OutputDestinationProperty;
  }

  private createUrlDestination(): medialive.CfnChannel.OutputDestinationProperty {
    if (this.outputConfig.type === MediaLiveOutputGroupType.MEDIAPACKAGE) {
      throw new Error("Endpoint configuration is required for CMAF/HLS output group types");
    }

    const settings = this.outputConfig.channelClass === "SINGLE_PIPELINE" 
      ? [{ url: this.outputConfig.endpoints.primary }]
      : [
          { url: this.outputConfig.endpoints.primary }, 
          { url: this.outputConfig.endpoints.secondary }
        ];
        
    return {
      id: "media-destination",
      settings
    } as medialive.CfnChannel.OutputDestinationProperty;
  }

  private getOutputGroupSettings(): any {
    const outputGroupConfigs = {
      [MediaLiveOutputGroupType.CMAF]: {
        cmafIngestGroupSettings: {
          destination: { destinationRefId: "media-destination" },
          nielsenId3Behavior: "NO_PASSTHROUGH",
          scte35Type: "SCTE_35_WITHOUT_SEGMENTATION",
          segmentLength: this.configuration.segmentLengthInSeconds,
          segmentLengthUnits: "SECONDS"
        }
      },
      [MediaLiveOutputGroupType.HLS]: {
        hlsGroupSettings: {
          adMarkers: this.getAdMarkersArray(),
          destination: { destinationRefId: "media-destination" },
          hlsCdnSettings: {
            hlsBasicPutSettings: {
              connectionRetryInterval: 1,
              filecacheDuration: 300,
              numRetries: 10,
              restartDelay: 15
            }
          },
          hlsId3SegmentTagging: "ENABLED",
          inputLossAction: "PAUSE_OUTPUT",
          segmentLength: this.configuration.segmentLengthInSeconds,
          minSegmentLength: this.configuration.minimumSegmentLengthInSeconds,
          programDateTime: "INCLUDE",
          programDateTimeClock: "SYSTEM_CLOCK",
          programDateTimePeriod: this.configuration.segmentLengthInSeconds,
        }
      },
      [MediaLiveOutputGroupType.MEDIAPACKAGE]: {
        mediaPackageGroupSettings: {
          destination: { destinationRefId: "media-destination" }
        }
      }
    };

    const config = outputGroupConfigs[this.outputConfig.type];
    if (!config) {
      throw new Error(`Unknown output group type: ${this.outputConfig.type}`);
    }
    
    return config;
  }

  private getAdMarkersArray(): Array<string> {
    const adMarkers: Array<string> = [];
    if (
      this.configuration.adMarkers !== undefined &&
      this.configuration.adMarkers !== ""
    ) {
      adMarkers.push(this.configuration.adMarkers);
    }
    return adMarkers;
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

  private setMediaPackageOutputGroupSpecificSettings(encoderSettings: any) {
    // Method to configure settings specific to MediaPackage output groups
    
    // Set output settings for each output in the output group
    for (var output of encoderSettings.outputGroups[0].outputs) {
      // MediaPackage output groups use mediaPackageOutputSettings
      if (!output.outputSettings) {
        output.outputSettings = {};
      }
      
      // Ensure mediaPackageOutputSettings is set (should already be from the profile)
      if (!output.outputSettings.mediaPackageOutputSettings) {
        output.outputSettings.mediaPackageOutputSettings = {};
      }
    }
  }

  constructor(scope: Construct, id: string, props: IMediaLiveProps) {
    super(scope, id);

    const { configuration, mediaLiveAccessRoleArn } = props;
    this.configuration = configuration;

    // Initialize output configuration
    this.outputConfig = props.destinationConfig;
    this.outputConfig.channelClass = configuration.channelClass;

    //1. Create the MediaLive Inputs
    // Initialize the array to store all inputs
    this.channelInputs = [];

    // Determine which inputs to use
    let inputsToProcess: MediaLiveInput[] = configuration.inputs;

    // Create all the MediaLive Inputs
    const inputAttachments: medialive.CfnChannel.InputAttachmentProperty[] = [];
    
    inputsToProcess.forEach((inputConfig, index) => {
      const inputName = 
        inputConfig.inputName || 
        `${Aws.STACK_NAME}_${inputConfig.type}_MediaLiveInput_${index + 1}`;
      const mediaLiveInput = new medialive.CfnInput(
        this,
        `MediaInputChannel${index + 1}`,
        this.createInputProps(
          inputName,
          inputConfig,
          mediaLiveAccessRoleArn,
          props.tags,
        ),
      );
      
      // Add to the array of inputs
      this.channelInputs.push(mediaLiveInput);
      
      // Create input attachment for this input
      inputAttachments.push({
        inputId: mediaLiveInput.ref,
        inputAttachmentName: mediaLiveInput.name,
        inputSettings: this.getAttachedInputSettings(inputConfig),
      });
    });

    //2. Create Channel
    // Load MediaLive Output settins from configurations file
    var encoderSettings;
    try {
      // Use fs.readFileSync instead of require to read the file
      const fs = require('fs');
      const fileContent = fs.readFileSync(configuration.encodingProfileLocation, 'utf8');
      encoderSettings = JSON.parse(fileContent);
    } catch (error) {
      throw new Error(`Failed to load encoder settings from ${configuration.encodingProfileLocation}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    // Configure output group settings
    encoderSettings.outputGroups[0].outputGroupSettings =
      this.getOutputGroupSettings();

    // Configure featureActivations
    encoderSettings.featureActivations = {
      inputPrepareScheduleActions: configuration.enableInputPrepareScheduleActions===true ? "ENABLED" : "DISABLED",
      outputStaticImageOverlayScheduleActions: configuration.enableStaticImageOverlayScheduleActions===true ? "ENABLED" : "DISABLED",
    };

    if (this.outputConfig.type === MediaLiveOutputGroupType.HLS) {
      // Set unique output configuration required for HLS output groups
      // CMAF and MediaPackage Output groups require significantly less configuration
      this.setHlsOutputGroupSpecificSettings(encoderSettings);
    } else if (this.outputConfig.type === MediaLiveOutputGroupType.MEDIAPACKAGE) {
      // Set unique output configuration required for MediaPackage output groups
      this.setMediaPackageOutputGroupSpecificSettings(encoderSettings);
    }
      
    // Set additional MediaLive Anywhere configuration if specified
    var anywhereSettings:
      | medialive.CfnChannel.AnywhereSettingsProperty
      | undefined = configuration.anywhereSettings;

    const channelLive = new medialive.CfnChannel(this, "MediaLiveChannel", {
      channelClass: configuration.channelClass,
      anywhereSettings: anywhereSettings,
      destinations: [
        this.createDestinationSettings(),
      ],
      tags: TaggingUtils.convertToMapTags(props.tags),
      inputSpecification: {
        codec: configuration.inputSpecification.codec,
        resolution: configuration.inputSpecification.resolution,
        maximumBitrate: configuration.inputSpecification.maximumBitrate,
      },
      name: props.channelName,
      roleArn: mediaLiveAccessRoleArn,
      inputAttachments: inputAttachments,
      encoderSettings:
        encoderSettings as medialive.CfnChannel.EncoderSettingsProperty,
    });

    this.channelLive = channelLive;

    /*
     * Final step: Exporting Variables for Cfn Outputs 👇
     */
    new CfnOutput(this, "MediaLiveChannelArn", {
      value: this.channelLive.attrArn,
      exportName: Aws.STACK_NAME + "mediaLiveChannelArn",
      description: "The Arn of the MediaLive Channel",
    });
    
    // Export information about each input
    this.channelInputs.forEach((input, index) => {
      new CfnOutput(this, `MediaLiveChannelInputName${index + 1}`, {
        value: input.name || `Input-${index + 1}`,
        exportName: Aws.STACK_NAME + `mediaLiveChannelInputName${index + 1}`,
        description: `The Input Name of the MediaLive Channel Input ${index + 1}`,
      });
    });
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
