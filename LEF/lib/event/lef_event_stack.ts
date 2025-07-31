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

import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { MediaPackageV2 } from "./mediapackagev2";
import { MediaLive, MediaLiveOutputGroupType } from "./medialive";
import {
  Aws,
  Fn,
  aws_iam as iam,
  CfnParameter,
  CfnOutput,
} from "aws-cdk-lib";
import {
  IEventConfig,
  IMediaLiveConfig,
  IMediaPackageChannelConfig,
} from "./eventConfigInterface";
import { LefBaseStack } from "../lef_base_stack";
import { ConfigurationError } from "../config/configValidator";
import * as fs from 'fs';
import { TaggingUtils } from "../utils/tagging";

interface CaptionDescription {
  name: string;
  captionSelectorName: string;
  languageCode?: string;
  languageDescription?: string;
}

export class LefEventStack extends LefBaseStack {
  constructor(
    scope: Construct,
    id: string,
    props: cdk.StackProps,
    configFilePath: string,
  ) {
    super(scope, id, props);

    // Import event configuration
    const config = this.loadConfig(configFilePath);

    // Sets various default configuration values based on the 
    // to ensure configuration is coherent.
    this.setDependentConfigParameters(config);

    // Validate event configuration
    this.validateConfig(config);

    /*
     * Define Stack Parameters
     */
    const eventGroupStackNameParam = new CfnParameter(
      this,
      "eventGroupStackName",
      {
        type: "String",
        description: "Name of Event Group Stack to associate the event with.",
        allowedPattern: ".+",
        constraintDescription: "Event Group Stack Name cannot be empty",
      },
    );

    // Getting configuration information
    var configuration = config.event;

    const channelName = Aws.STACK_NAME;
    const eventGroupStackName = eventGroupStackNameParam.valueAsString;

    const foundationStackName = Fn.importValue(
      eventGroupStackName + "-Foundation-Stack-Name",
    );
    const mediaLiveAccessRoleArn = Fn.importValue(
      eventGroupStackName + "-MediaLiveAccessRoleArn",
    );
    const cloudFrontDomain = Fn.importValue(
      eventGroupStackName + "-CloudFront-DomainName",
    );
    const nominalDeliverySegmentSize = Fn.importValue(
      eventGroupStackName + "-Nominal-Delivery-Segment-Size",
    );
    const mediaTailorHlsPlaybackPrefix = Fn.importValue(
      eventGroupStackName + "-MediaTailor-Hls-Playback-Prefix",
    );
    const mediaTailorDashPlaybackPrefix = Fn.importValue(
      eventGroupStackName + "-MediaTailor-Dash-Playback-Prefix",
    );
    const mediaTailorSessionPrefix = Fn.importValue(
      eventGroupStackName + "-MediaTailor-Session-Prefix",
    );

    // Create standard tags for event stack
    this.resourceTags = this.createStandardTags(
      scope,
      "LefEventStack",
      foundationStackName,
      eventGroupStackName,
      Aws.STACK_NAME,
    );

    /*
     * Create MediaPackage Channel
     */
    const mediaPackageChannel = new MediaPackageV2(
      this,
      "MediaPackageChannel",
      {
        channelName: channelName,
        channelGroupName: eventGroupStackName,
        configuration: configuration.mediaPackage,
        tags: this.resourceTags,
      },
    );

    /*
     * Define Event output parameters
     */

    // Iterate over all the manifest types and create output variables
    for (const endpointOutput of mediaPackageChannel.channelEndpointOutputs) {
      // Iterate over all the manifests in each manifest type to create output variables
      for (const manifest of endpointOutput.manifests) {
        let outputRef = "";
        let outputRefBase = `${manifest.endpointReference}_${manifest.type}_${manifest.name}`;

        // Set the MediaTailor Playback Prefix based on the manifest type.
        // HLS and low latency HLS manifests use the same MediaTailor Playback Prefix
        let mediaTailorPlaybackPrefix = mediaTailorHlsPlaybackPrefix;
        if (
          manifest.type !== "hlsManifests" &&
          manifest.type !== "lowLatencyHlsManifests"
        ) {
          mediaTailorPlaybackPrefix = mediaTailorDashPlaybackPrefix;
        }

        // MediaTailor Session URL Ouput
        outputRef = `${outputRefBase}_MediaTailorSessionUrl`;
        new CfnOutput(this, outputRef, {
          value: Fn.join("", [mediaTailorSessionPrefix, manifest.path]),
        });

        // MediaTailor Playback URL Output
        outputRef = `${outputRefBase}_MediaTailorPlaybackUrl`;
        new CfnOutput(this, outputRef, {
          value: Fn.join("", [mediaTailorPlaybackPrefix, manifest.path]),
        });

        // MediaPackage Endpoint URL Output
        outputRef = `${outputRefBase}_MediaPackagePlaybackUrl`;
        new CfnOutput(this, outputRef, {
          value: Fn.join("/", [`https://${cloudFrontDomain}`, manifest.path]),
        });
      }
    }

    /*
     * Create encoding resources
     * Workflow can be configured to use either an AWS Elemental MediaLive or Elemental Live encoder (not both).
     */
    if (configuration.mediaLive) {
      /*
       * Create MediaLive Channel
       */
      // Determine the actual MediaLive output group type from the encoding profile
      const mediaLiveOutputGroupType = this.identifyMediaLiveOutputGroupType(
        configuration.mediaLive.encodingProfileLocation,
      );

      const mediaLiveChannel = new MediaLive(this, "MediaLiveChannel", {
        channelName: channelName,
        mediaLiveAccessRoleArn: mediaLiveAccessRoleArn,
        configuration: configuration.mediaLive,
        destinationConfig: mediaLiveOutputGroupType === MediaLiveOutputGroupType.MEDIAPACKAGE ? {
          type: MediaLiveOutputGroupType.MEDIAPACKAGE,
          channelClass: configuration.mediaLive.channelClass,
          mediaPackage: {
            channelName: channelName,
            channelGroup: eventGroupStackName
          }
        } : {
          type: mediaLiveOutputGroupType,
          channelClass: configuration.mediaLive.channelClass,
          endpoints: {
            primary: mediaPackageChannel.channelIngestEndpoint1,
            secondary: mediaPackageChannel.channelIngestEndpoint2
          }
        },
        tags: this.resourceTags,
      });
      // MediaLive needed to create the an IAM role before it could be included in the
      // MediaPackage channel policy.
      mediaPackageChannel.attachChannelPolicy(mediaLiveAccessRoleArn);
    } else if (configuration.elementalLive) {
      /*
       * On premise Elemental Live applicance will be used and channel needs to allow
       * user configured in appliance permission to "mediapackagev2:PutObject"
       */
      mediaPackageChannel.attachChannelPolicy(
        configuration.elementalLive.userArn,
        configuration.elementalLive.inputCidr,
      );

      // Create outputs containing MediaPackage Channel Ingest Endpoints
      // MediaPackage Channel Ingest Endpoints are only required as outputs when using an on-premises encoder
      // as if MediaLive is being used the MediaLive input is the entry point into the workflow.
      new CfnOutput(this, "MediaPackageChannelIngestEndpoint1", {
        value: mediaPackageChannel.channelIngestEndpoint1,
        exportName: Aws.STACK_NAME + "-MediaPackageChannelIngestEndpoint1",
        description: "MediaPackage Channel Ingest Endpoint1",
      });
      new CfnOutput(this, "MediaPackageChannelIngestEndpoint2", {
        value: mediaPackageChannel.channelIngestEndpoint2,
        exportName: Aws.STACK_NAME + "-MediaPackageChannelIngestEndpoint2",
        description: "MediaPackage Channel Ingest Endpoint2",
      });
    }
  }

  loadConfig(configFilePath: string): IEventConfig {
    return this.getConfig<IEventConfig>(configFilePath, "EVENT_CONFIG");
  }

  // set dependent configuration parameters
  setDependentConfigParameters(config: IEventConfig) {
    // For all origin endpoints set DASH Manifest drmSignaling if encryption enabled and not already specified
    const mediaPackageConfig: IMediaPackageChannelConfig =
      config.event.mediaPackage;
    for (const [endpointReference, endpointConfig] of Object.entries(
      mediaPackageConfig.endpoints,
    )) {
      // Default for DASH drmSignaling only require if encryption is enabled
      if (
        endpointConfig.segment.encryption &&
        endpointConfig.dashManifests &&
        endpointConfig.dashManifests.length > 0
      ) {
        // For each DASH manifest apply default drmSignaling where a value has not been specified in configuraiton
        for (const manifest of endpointConfig.dashManifests) {
          if (!manifest.drmSignaling) {
            manifest.drmSignaling = "REFERENCED";
          }
        }
      }
    }

    // Set defaults for MediaLive parameters if not set explicitly
    if ( config.event.mediaLive ) {

      // Set default value to passthrough SCTE-35 for MediaLive HLS/TS outputs
      if (!config.event.mediaLive.scte35Behavior) {
        config.event.mediaLive.scte35Behavior = "PASSTHROUGH";
      }

      // Set a default value for a medialive minimum segment length if not specified
      if (config.event.mediaLive.minimumSegmentLengthInSeconds === undefined) {
        config.event.mediaLive.minimumSegmentLengthInSeconds = 1;
      }

      // Set a default value for HLS Ad Markers
      if (config.event.mediaLive.adMarkers === undefined) {
        config.event.mediaLive.adMarkers = "ELEMENTAL_SCTE35";
      }

      // Set enableInputPrepareScheduleActions feature activiation 
      // if not explicitly set in configuration
      if (config.event.mediaLive.enableInputPrepareScheduleActions===undefined) {
        config.event.mediaLive.enableInputPrepareScheduleActions = true;
      }

      // Set enableInputPrepareScheduleActions feature activiation 
      // if not explicitly set in configuration
      if (config.event.mediaLive.enableStaticImageOverlayScheduleActions===undefined) {
        config.event.mediaLive.enableStaticImageOverlayScheduleActions = true;
      }
    }

  }

  // validate event configuration
  validateConfig(config: IEventConfig): void {
    // Additional event-specific validations
    if (config.event.mediaLive) {
      const mediaLiveConfig = config.event.mediaLive;
      const mediaPackageConfig = config.event.mediaPackage;

      // // Perform basic validation of MediaLive encoding profile location
      const encoderSettings = this.loadAndValidateEncodingProfile(mediaLiveConfig);

      // Verify MediaLive Anywhere configuration and inputs
      if (
        mediaLiveConfig.anywhereSettings &&
        mediaLiveConfig.channelClass == "STANDARD"
      ) {
        throw new ConfigurationError(
          "Invalid MediaLive Configuration. MediaLive Anywhere does not support STANDARD channels.",
        );
      }

      // Validate Media Live inputs
      if (mediaLiveConfig.inputs) {
        mediaLiveConfig.inputs.forEach((input) => {
         
          if (
            input.type == "MULTICAST" &&
            !input.multicastSettings
          ) {
            throw new Error(
              'Invalid MediaLive Input Configuration. Multicast input require "multicastSettings" to be specified.',
            );
          }

          // Identify if input type is a MediaLive Anywhere only input raise and error if the channel is not a MediaLive Anywhere channel
          if (
            ["MULTICAST"].includes(input.type) &&
            !mediaLiveConfig.anywhereSettings
          ) {
            throw new ConfigurationError(
              `Invalid MediaLive Configuration. '${input.type}' inputs are only available on MediaLive Anywhere.`,
            );
          }

        });
      }

      // Verify MediaLive output type (i.e. HLS or CMAF Ingest) matches MediaPackage Ingest configuration
      // Validate compatibility between MediaLive output and MediaPackage input types
      const mediaLiveOutputGroupType = this.identifyMediaLiveOutputGroupType(
        mediaLiveConfig.encodingProfileLocation,
      );
      if (
        (mediaLiveOutputGroupType === "CMAF" &&
          mediaPackageConfig.inputType !== "CMAF") ||
        (mediaLiveOutputGroupType === "HLS" &&
          mediaPackageConfig.inputType !== "HLS")
      ) {
        throw new ConfigurationError(
          `MediaLive output type "${mediaLiveOutputGroupType}" is not compatible with ` +
            `MediaPackage input type "${mediaPackageConfig.inputType}". Both types must match.`,
        );
      }

      // Encoding profile captions configuration match MediaLive input configuration
      this.validateCaptionsConfig( mediaLiveConfig, encoderSettings );
    }

    // Validate MediaPackage endpoints
    Object.entries(config.event.mediaPackage.endpoints).forEach(
      ([endpointName, endpoint]) => {
        if (
          endpoint.containerType !== "CMAF" &&
          endpoint.containerType !== "TS"
        ) {
          throw new Error(
            `Invalid container type for MediaPackage endpoint "${endpointName}". Must be either "CMAF" or "TS"`,
          );
        }

        const manifestCount =
          (endpoint.hlsManifests?.length || 0) +
          (endpoint.lowLatencyHlsManifests?.length || 0) +
          (endpoint.dashManifests?.length || 0);

        if (manifestCount === 0) {
          throw new Error(
            `MediaPackage endpoint "${endpointName}" must have at least one manifest`,
          );
        }

        // Validate manifest name uniqueness
        const manifestNames = new Set<string>();
        [
          ...(endpoint.hlsManifests || []),
          ...(endpoint.lowLatencyHlsManifests || []),
          ...(endpoint.dashManifests || []),
        ].forEach((manifest) => {
          if (manifestNames.has(manifest.manifestName)) {
            throw new Error(
              `Duplicate manifest name "${manifest.manifestName}" in MediaPackage endpoint "${endpointName}"`,
            );
          }
          manifestNames.add(manifest.manifestName);
        });
      },
    );
  }

  /**
   * Loads and validates MediaLive encoding profile by checking file existence and JSON format
   * @param mediaLiveConfig - Configuration object containing encoding profile location
   * @returns The parsed JSON content of the encoding profile
   * @throws ConfigurationError if file doesn't exist or contains invalid JSON
   */
  private loadAndValidateEncodingProfile(mediaLiveConfig: IMediaLiveConfig, ): any {

    // Check if file exists
    const encodingProfileLocation = mediaLiveConfig.encodingProfileLocation;

    if (!this.fileExists(encodingProfileLocation)) {
      throw new ConfigurationError(
        `Encoding profile location file "${encodingProfileLocation}" does not exist.`
      );
    }

    try {
      // Read and parse the JSON file
      const fileContent = fs.readFileSync(encodingProfileLocation, 'utf8');
      return JSON.parse(fileContent);
    } catch (error: unknown) {
      if (error instanceof SyntaxError) {
        throw new ConfigurationError(
          `Encoding profile at "${encodingProfileLocation}" contains invalid JSON: ${error.message}`
        );
      }
      // Handle unknown error type safely
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Unknown error occurred';
      
      throw new ConfigurationError(
        `Failed to read encoding profile at "${encodingProfileLocation}": ${errorMessage}`
      );
    }
  }

  /**
   * Checks if a file exists at the specified path
   * @param filePath - Path to the file to check
   * @returns true if file exists, false otherwise or if error occurs
   */
  private fileExists(filePath: string): boolean {
    try {
      return fs.existsSync(filePath);
    } catch (error) {
      return false;
    }
  }

  /**
   * Validates the caption configuration by ensuring all caption selectors referenced in the encoder settings
   * exist in the MediaLive configuration.
   * 
   * @param medialiveConfig - The MediaLive configuration object containing caption selectors
   * @param encoderSettings - The encoder settings object containing caption descriptions
   * @throws ConfigurationError if a caption selector referenced in encoder settings is not found in MediaLive config
   */
  validateCaptionsConfig(
    medialiveConfig: IMediaLiveConfig, 
    encoderSettings: {
      captionDescriptions?: Array<CaptionDescription>
    }
  ): void {

    // Get caption selectors from MediaLive Input settings
    const inputCaptionSelectors = medialiveConfig.captionSelectors || [];

    // Get caption selectors referenced in encoder settings
    const encoderCaptionSelectors = this.getCaptionSelectorNames(
      encoderSettings.captionDescriptions || []
    );

    // Skip validation if no caption selectors are referenced
    if (!encoderCaptionSelectors.length) {
      return;
    }

    // Create a Set for O(1) lookup performance
    const availableCaptionSelectors = new Set(
      inputCaptionSelectors.map(selector => selector.name)
    );

    // Validate each encoder caption selector exists in MediaLive config
    for (const captionSelector of encoderCaptionSelectors) {
      if (!availableCaptionSelectors.has(captionSelector)) {
        throw new ConfigurationError(
          `Caption selector "${captionSelector}" in the encoding profile is not present in the MediaLive configuration.`
        );
      }
    }
  }

  /**
   * Returns an array of caption selector names from MediaLive caption descriptions
   * @param captionDescriptions - Array of MediaLive caption description objects
   * @returns Array of caption selector names as strings
   */
  getCaptionSelectorNames(captionDescriptions: CaptionDescription[]): string[] {
    return captionDescriptions.map(desc => desc.captionSelectorName);
  }

  /**
   * Determines the MediaLive output group type by analyzing the encoder settings profile.
   *
   * @param encodingProfile - Path to the encoder settings profile JSON file
   * @returns MediaLiveOutputGroupType - The identified output group type
   * @throws Error if the profile cannot be loaded or has invalid settings
   */
  identifyMediaLiveOutputGroupType(encodingProfile: string): MediaLiveOutputGroupType {
    interface EncoderSettings {
      outputGroups?: Array<{
        outputGroupSettings?: {
          cmafIngestGroupSettings?: unknown;
          mediaPackageGroupSettings?: unknown;
          hlsGroupSettings?: unknown;
        };
      }>;
    }

    let encoderSettings: EncoderSettings;

    // load encoding profile
    try {
      // Use fs.readFileSync instead of require to read the file
      const fileContent = fs.readFileSync(encodingProfile, 'utf8');
      encoderSettings = JSON.parse(fileContent);

      // Validate the loaded settings
      if (!encoderSettings || typeof encoderSettings !== "object") {
        throw new Error("Invalid encoder settings format");
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(
          `Failed to load encoder settings from ${encodingProfile}: ${error.message}`,
        );
      } else {
        throw new Error("Failed to load encoder settings: Unknown error");
      }
    }

    // Check output group settings
    if (!encoderSettings.outputGroups?.[0]?.outputGroupSettings) {
      throw new Error(
        "Invalid encoder settings: Missing output group settings",
      );
    }
    
    const outputGroupSettings =
    encoderSettings.outputGroups[0].outputGroupSettings;
    if (outputGroupSettings.cmafIngestGroupSettings) {
      return MediaLiveOutputGroupType.CMAF;
    } else if (outputGroupSettings.mediaPackageGroupSettings) {
      return MediaLiveOutputGroupType.MEDIAPACKAGE;
    } else if (outputGroupSettings.hlsGroupSettings) {
      return MediaLiveOutputGroupType.HLS;
    } else {
      throw new Error("Invalid MediaLive output group type");
    }
  }
}
