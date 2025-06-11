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

import { aws_mediatailor as mediatailor, Fn } from "aws-cdk-lib";
import { Construct } from "constructs";
import { IEventGroupMediaTailorConfig } from "./eventGroupConfigInterface";

export interface MediaTailorProps {
  configurationName: string;
  configuration: IEventGroupMediaTailorConfig;
  originHostname: string;
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

  constructor(scope: Construct, id: string, props: MediaTailorProps) {
    super(scope, id);

    const configuration = props.configuration;

    //👇 Defining configuration Aliases to have one single EMT configuration working for HLS and MPEG DASH (not to be changed to work with this CDK)
    const configurationAliasesValue: ConfigurationAliasesValue = {
      "player_params.content_segment_prefix": {
        "hls-cmaf": "../../../../..",
        "dash-cmaf": "../../../../../../../../..",
      },
      "player_params.ad_segment_prefix": {
        "hls-cmaf": "../../../../../..",
        "dash-cmaf": "../../../../../../../../..",
      },
    };

    // Set custom transcode profile (if defined in event group configuration)
    if (configuration && configuration.transcodeProfiles) {
      const transcodeProfiles = configuration.transcodeProfiles;

      // Add additional "player_params.transcode_profile" key to configurationAliasesValue
      configurationAliasesValue["player_params.transcode_profile"] = {
        "hls-cmaf": transcodeProfiles.hlsCmaf ? transcodeProfiles.hlsCmaf : "",
        "dash-cmaf": transcodeProfiles.dashCmaf
          ? transcodeProfiles.dashCmaf
          : "",
      };
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
        name: props.configurationName,
        videoContentSourceUrl: "https://" + props.originHostname,
        // the properties below are optional
        availSuppression: availSuppressionSettings,
        bumper: bumperSettings,
        configurationAliases: configurationAliasesValue,
        cdnConfiguration: {
          adSegmentUrlPrefix: configuration.adSegmentUrl,
          contentSegmentUrlPrefix: configuration.contentSegmentUrl,
        },
        dashConfiguration: {
          mpdLocation: "DISABLED",
          originManifestType: "MULTI_PERIOD",
        },
        livePreRollConfiguration: {
          adDecisionServerUrl: configuration.preRolladDecisionServerUrl,
          maxDurationSeconds: configuration.preRollDuration,
        },
        manifestProcessingRules: {
          adMarkerPassthrough: {
            enabled: configuration.adMarkerPassthrough,
          },
        },
        personalizationThresholdSeconds: configuration.personalizationThreshold,
        slateAdUrl: configuration.slateAdUrl,
        transcodeProfileName: configuration.transcodeProfiles
          ? "[player_params.transcode_profile]"
          : "",
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
    this.configHostname = Fn.select(2, Fn.split("/", this.sessionEndpoint));
    this.playbackConfigurationArn = this.configEMT.attrPlaybackConfigurationArn;
  }
}
