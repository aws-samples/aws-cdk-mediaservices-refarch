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

import { Aws, aws_mediatailor as mediatailor, Fn } from "aws-cdk-lib";
import { Construct } from "constructs";
import { IEventGroupMediaTailorConfig } from "./eventGroupConfigInterface";
import { TaggingUtils } from "../utils/tagging";

export const MEDIATAILOR_MANIFESTS_HOSTNAME = `manifests.mediatailor.${Aws.REGION}.amazonaws.com`;
export const MEDIATAILOR_SEGMENTS_HOSTNAME = `segments.mediatailor.${Aws.REGION}.amazonaws.com`;

export interface MediaTailorProps {
  configurationName: string;
  configurationNameSuffix?: string;
  configuration: IEventGroupMediaTailorConfig;
  originHostname: string;
  tags?: Record<string, string>[];
}

interface ConfigurationAliasesValue {
  "player_params.content_segment_prefix": {
    "hls-cmaf": string;
    "dash-cmaf": string;
  };
  "player_params.ad_segment_prefix": {
    "hls-cmaf": string;
    "dash-cmaf": string;
  };
  "player_params.transcode_profile"?: {
    "hls-cmaf": string;
    "dash-cmaf": string;
  };
}

export class MediaTailor extends Construct {
  public readonly configEMT: mediatailor.CfnPlaybackConfiguration;
  private HLS_ENDPOINT = "HlsConfiguration.ManifestEndpointPrefix";
  private DASH_ENDPOINT = "DashConfiguration.ManifestEndpointPrefix";
  private SESSION_ENDPOINT = "SessionInitializationEndpointPrefix";
  public readonly hlsEndpoint: string;
  public readonly dashEndpoint: string;
  public readonly sessionEndpoint: string;
  public readonly configHostname: string;
  public readonly playbackConfigurationArn: string;
  public readonly configurationName: string;

  constructor(scope: Construct, id: string, props: MediaTailorProps) {
    super(scope, id);

    const configuration = props.configuration;
    
    // Create the full configuration name using the base name and the configuration name if provided
    this.configurationName = props.configurationNameSuffix && configuration.name
      ? `${props.configurationName}-${configuration.name}`
      : props.configurationName;

    // Initialize as empty object
    let configurationAliasesValue: ConfigurationAliasesValue = {} as ConfigurationAliasesValue;

    // Set relative content segment prefix alias if parameter configured for content segment prefix
    if (configuration && configuration.contentSegmentUrlPrefix && configuration.contentSegmentUrlPrefix === "[player_params.content_segment_prefix]" ) {
      configurationAliasesValue["player_params.content_segment_prefix"] = {
        "hls-cmaf": "../../../../..",
        "dash-cmaf": "../../../../../../../../..",
      };
    }

    // Set relative content segment prefix alias if parameter configured for content segment prefix
    if (configuration && configuration.adSegmentUrlPrefix && configuration.adSegmentUrlPrefix === "[player_params.ad_segment_prefix]" ) {
      configurationAliasesValue["player_params.ad_segment_prefix"] = {
        "hls-cmaf": "../../../../../..",
        "dash-cmaf": "../../../../../../../../..",
      };
    }

    // Set custom transcode profile (if defined in event group configuration)
    if (configuration && configuration.transcodeProfiles) {
      const transcodeProfiles = configuration.transcodeProfiles;

      // Only add transcode profile if at least one value is non-empty
      if ((transcodeProfiles.hlsCmaf && transcodeProfiles.hlsCmaf !== "") || 
          (transcodeProfiles.dashCmaf && transcodeProfiles.dashCmaf !== "")) {
        
        // Add additional "player_params.transcode_profile" key to configurationAliasesValue
        configurationAliasesValue["player_params.transcode_profile"] = {
          "hls-cmaf": transcodeProfiles.hlsCmaf ? transcodeProfiles.hlsCmaf : "",
          "dash-cmaf": transcodeProfiles.dashCmaf ? transcodeProfiles.dashCmaf : "",
        };
      }
    }

    // Set default empty bumpers if not defined in event group configuration
    let bumperSettings = {
      startUrl: "",
      endUrl: "",
    };
    if (configuration.bumper) {
      if (configuration.bumper.startUrl)
        bumperSettings.startUrl = configuration.bumper.startUrl;
      if (configuration.bumper.endUrl)
        bumperSettings.endUrl = configuration.bumper.endUrl;
    }

    // Disable avail suppression unless specified in configuration
    const availSuppressionConfig = configuration.availSuppression;
    let availSuppressionSettings = {
      mode: "OFF",
      value: "",
      fillPolicy: "FULL_AVAIL_ONLY",
    };
    if (availSuppressionConfig) {
      if (availSuppressionConfig.mode)
        availSuppressionSettings.mode = availSuppressionConfig.mode;
      if (availSuppressionConfig.value)
        availSuppressionSettings.value = availSuppressionConfig.value;
      if (availSuppressionConfig.fillPolicy)
        availSuppressionSettings.fillPolicy = availSuppressionConfig.fillPolicy;
    }

    //👇 Creating EMT config
    this.configEMT = new mediatailor.CfnPlaybackConfiguration(
      this,
      "MyCfnPlaybackConfiguration",
      {
        adDecisionServerUrl: configuration.adDecisionServerUrl,
        name: this.configurationName,
        videoContentSourceUrl: "https://" + props.originHostname,
        // the properties below are optional
        availSuppression: availSuppressionSettings,
        bumper: bumperSettings,
        configurationAliases: Object.keys(configurationAliasesValue).length > 0 ? configurationAliasesValue : undefined,
        cdnConfiguration: {
          adSegmentUrlPrefix: configuration.adSegmentUrlPrefix,
          contentSegmentUrlPrefix: configuration.contentSegmentUrlPrefix,
        },
        dashConfiguration: {
          mpdLocation: "DISABLED",
          originManifestType: "MULTI_PERIOD",
        },
        insertionMode: configuration.insertionMode && 
          ['STITCHED_ONLY', 'PLAYER_SELECT'].includes(configuration.insertionMode) 
          ? configuration.insertionMode 
          : 'STITCHED_ONLY',
        livePreRollConfiguration: {
          adDecisionServerUrl: configuration.preRolladDecisionServerUrl,
          maxDurationSeconds: configuration.preRollDuration,
        },
        logConfiguration: {
          percentEnabled: configuration.logPercentageEnabled !== undefined ? 
            Math.min(Math.max(configuration.logPercentageEnabled, 0), 100) : 10,
        },
        manifestProcessingRules: {
          adMarkerPassthrough: {
            // adMarkerPassthrough defaults to false if not specified in configuration
            enabled: configuration.adMarkerPassthrough ? configuration.adMarkerPassthrough : false ,
          },
        },
        personalizationThresholdSeconds: configuration.personalizationThreshold,
        slateAdUrl: configuration.slateAdUrl || "",
        transcodeProfileName: configuration.transcodeProfiles
          ? "[player_params.transcode_profile]"
          : "",
        tags: TaggingUtils.convertToCfnTags(props.tags),
      },
    );

    //👇 Exporting endpoint from EMT
    this.dashEndpoint = Fn.getAtt(
      this.configEMT.logicalId,
      this.DASH_ENDPOINT,
    ).toString();
    this.hlsEndpoint = Fn.getAtt(
      this.configEMT.logicalId,
      this.HLS_ENDPOINT,
    ).toString();
    this.sessionEndpoint = Fn.getAtt(
      this.configEMT.logicalId,
      this.SESSION_ENDPOINT,
    ).toString();
    
    // Override the MediaTailor configuration subdomain to simplify CloudFront configuration.
    // All MediaTailor subdomains in a region point to the same destination. By using the same
    // subdomain for all MediaTailor configurations, no additional MediaTailor behaviours need
    // to be configured in CloudFront.
    // As any subdomain is valid, rather than using the subdomain for a given MediaTailor
    // Configuration, this project will use 'manifest.mediatailor.<region>.amazonaws.com'
    // as the subdomain for all configurations.
    this.configHostname = MEDIATAILOR_MANIFESTS_HOSTNAME;
    this.playbackConfigurationArn = this.configEMT.attrPlaybackConfigurationArn;
  }
}
