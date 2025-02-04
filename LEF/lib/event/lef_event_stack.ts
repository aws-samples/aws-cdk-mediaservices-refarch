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
import { MediaLive } from "./medialive";
import { Aws, Fn, CfnParameter, CfnOutput, aws_iam as iam } from "aws-cdk-lib";
import { IEventConfig, IMediaPackageChannelConfig } from './eventConfigInterface';

export class LefEventStack extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    props: cdk.StackProps,
    configFilePath: string,
  ) {
    super(scope, id, props);

    // Import event configuration
    const config = this.loadConfig(configFilePath);

    // Sets basic defaults for DRM Signaling in DASH manifests
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
      },
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
      const mediaLiveChannel = new MediaLive(this, "MediaLiveChannel", {
        channelName: channelName,
        mediaLiveAccessRoleArn: mediaLiveAccessRoleArn,
        configuration: configuration.mediaLive,
        outputGroupType: mediaPackageChannel.channelInputType,
        hlsIngestEndpoint1: mediaPackageChannel.channelIngestEndpoint1,
        hlsIngestEndpoint2: mediaPackageChannel.channelIngestEndpoint2,
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

  // load event configuration
  loadConfig( configFilePath: string ): IEventConfig {

    try {
      const config = require(configFilePath);
      return config.EVENT_CONFIG;
    } catch (err) {
      if (err instanceof Error) {
        throw new Error(
          `Failed to load configuration file (${configFilePath}): ${err.message}`,
        );
      } else {
        throw new Error(
          `Failed to load configuration file (${configFilePath}): ${String(err)}`,
        );
      }
    }
  }

  // set dependent configuration parameters
  setDependentConfigParameters( config: IEventConfig ) {

    // For all origin endpoints set DASH Manifest drmSignaling if encryption enabled and not already specified
    const mediaPackageConfig : IMediaPackageChannelConfig = config.event.mediaPackage;
    for (const [endpointReference, endpointConfig] of Object.entries(mediaPackageConfig.endpoints)) {

      // Default for DASH drmSignaling only require if encryption is enabled
      if ( endpointConfig.segment.encryption && endpointConfig.dashManifests && endpointConfig.dashManifests.length > 0 ) {

        // For each DASH manifest apply default drmSignaling where a value has not been specified in configuraiton
        for (const manifest of endpointConfig.dashManifests) {
          if ( !manifest.drmSignaling ) {
            manifest.drmSignaling = 'REFERENCED';
          }
        }
      }
    }

    // Set default value to passthrough SCTE-35 for MediaLive HLS/TS outputs
    if ( config.event.mediaLive && !config.event.mediaLive.scte35Behavior ) {
      config.event.mediaLive.scte35Behavior = 'PASSTHROUGH';
    }

    // Set a default value for a medialive minimum segment length if not specified
    if ( config.event.mediaLive && config.event.mediaLive.minimumSegmentLengthInSeconds === undefined ) {
      config.event.mediaLive.minimumSegmentLengthInSeconds = 1;
    }

    // Set a default value for HLS Ad Markers
    if ( config.event.mediaLive && config.event.mediaLive.adMarkers === undefined ) {
      config.event.mediaLive.adMarkers = 'ELEMENTAL_SCTE35';
    }
  }

  // validate event configuration
  validateConfig( config: IEventConfig ) {

    if (!config.event) {
      throw new Error('Event configuration is missing');
    }

    if (config.event.mediaLive && config.event.elementalLive ) {
      throw new Error('Invalid event type. Must be either "mediaLive" or "elementalLive, not both."');
    }

    if (!config.event.mediaLive && !config.event.elementalLive) {
      throw new Error('MediaLive or Elemental Live configuration must be specified');
    }

    if (!config.event.mediaPackage || Object.keys(config.event.mediaPackage).length === 0) {
      throw new Error('MediaPackage configuration is missing or empty');
    }

    // Verify MediaLive output type (i.e. HLS or CMAF Ingest) matches MediaPackage Ingest configuration
    if (config.event.mediaLive) {
      const mediaLiveConfig = config.event.mediaLive;
      const mediaPackageConfig = config.event.mediaPackage;

      // Validate compatibility between MediaLive output and MediaPackage input types
      const mediaLiveOutputGroupType = this.identifyMediaLiveOutputGroupType(mediaLiveConfig.encodingProfileLocation);
      if ((mediaLiveOutputGroupType === 'CMAF' && mediaPackageConfig.inputType !== 'CMAF') ||
          (mediaLiveOutputGroupType === 'HLS' && mediaPackageConfig.inputType !== 'HLS')) {
          console.error(`In the event configuration the encoding profile [event.medialive.encodingProfileLocation] ` +
            `must use an output group compatible with the MediaPackage Channel InputType ` +
            `[event.mediapackage.inputType].`);
          throw new Error(
              `MediaLive output type "${mediaLiveOutputGroupType}" is not compatible with ` +
              `MediaPackage input type "${mediaPackageConfig.inputType}". Both types must match.`
          );
      }

    }

    // Validate MediaPackage endpoints
    Object.entries(config.event.mediaPackage.endpoints).forEach(([endpointName, endpoint]) => {
      if (endpoint.containerType !== 'CMAF' && endpoint.containerType !== 'TS') {
        throw new Error(`Invalid container type for MediaPackage endpoint "${endpointName}". Must be either "CMAF" or "TS"`);
      }

      const manifestCount = (endpoint.hlsManifests?.length || 0) +
        (endpoint.lowLatencyHlsManifests?.length || 0) +
        (endpoint.dashManifests?.length || 0);

      if (manifestCount === 0) {
        throw new Error(`MediaPackage endpoint "${endpointName}" must have at least one manifest`);
      }

      // Validate manifest name uniqueness
      const manifestNames = new Set<string>();
      [
        ...(endpoint.hlsManifests || []),
        ...(endpoint.lowLatencyHlsManifests || []),
        ...(endpoint.dashManifests || [])
      ].forEach(manifest => {
        if (manifestNames.has(manifest.manifestName)) {
          throw new Error(`Duplicate manifest name "${manifest.manifestName}" in MediaPackage endpoint "${endpointName}"`);
        }
        manifestNames.add(manifest.manifestName);
      });
    });

  }

  /**
   * Determines the MediaLive output group type by analyzing the encoder settings profile.
   * 
   * @param encodingProfile - Path to the encoder settings profile JSON file
   * @returns "CMAF" | "HLS" - The identified output group type
   * @throws Error if the profile cannot be loaded or has invalid settings
   */
  identifyMediaLiveOutputGroupType(encodingProfile: string): "CMAF" | "HLS" {
    interface EncoderSettings {
      outputGroups?: Array<{
        outputGroupSettings?: {
          cmafIngestGroupSettings?: unknown;
          mediaPackageGroupSettings?: unknown;
        };
      }>;
    }

    let encoderSettings: EncoderSettings;

    // load encoding profile
    try {
      encoderSettings = require(encodingProfile);

      // Validate the loaded settings
      if (!encoderSettings || typeof encoderSettings !== 'object') {
        throw new Error('Invalid encoder settings format');
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(
          `Failed to load encoder settings from ${encodingProfile}: ${error.message}`
        );
      } else {
        throw new Error('Failed to load encoder settings: Unknown error');
      }
    }

    // Check output group settings
    if (!encoderSettings.outputGroups?.[0]?.outputGroupSettings) {
      throw new Error('Invalid encoder settings: Missing output group settings');
    }

    const outputGroupSettings = encoderSettings.outputGroups[0].outputGroupSettings;

    if (outputGroupSettings.cmafIngestGroupSettings) {
      return "CMAF";
    } else if (outputGroupSettings.mediaPackageGroupSettings) {
      return "HLS";
    } else {
      throw new Error('Invalid MediaLive output group type');
    }
  }

}
