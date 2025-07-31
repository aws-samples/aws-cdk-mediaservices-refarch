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

import { IEventGroupConfig, IEventGroupMediaTailorConfig } from "../../lib/event_group/eventGroupConfigInterface";

/**
 * Builder class for creating MediaTailor test configurations
 */
export class MediaTailorConfigBuilder {
  private config: IEventGroupMediaTailorConfig;

  constructor(name?: string) {
    this.config = {
      name: name || "test-config",
      adDecisionServerUrl: "https://ads.example.com",
      contentSegmentUrlPrefix: "/",
      adSegmentUrlPrefix: "/",
      slateAdUrl: "https://slate.example.com/slate.mov"
    };
  }

  withName(name: string): MediaTailorConfigBuilder {
    this.config.name = name;
    return this;
  }

  withAdDecisionServerUrl(url: string): MediaTailorConfigBuilder {
    this.config.adDecisionServerUrl = url;
    return this;
  }

  withContentSegmentUrlPrefix(prefix: string): MediaTailorConfigBuilder {
    this.config.contentSegmentUrlPrefix = prefix;
    return this;
  }

  withAdSegmentUrlPrefix(prefix: string): MediaTailorConfigBuilder {
    this.config.adSegmentUrlPrefix = prefix;
    return this;
  }

  withSlateAdUrl(url: string): MediaTailorConfigBuilder {
    this.config.slateAdUrl = url;
    return this;
  }

  withAdMarkerPassthrough(enabled: boolean): MediaTailorConfigBuilder {
    this.config.adMarkerPassthrough = enabled;
    return this;
  }

  withPersonalizationThreshold(threshold: number): MediaTailorConfigBuilder {
    this.config.personalizationThreshold = threshold;
    return this;
  }

  withBumpers(startUrl: string, endUrl: string): MediaTailorConfigBuilder {
    this.config.bumper = {
      startUrl,
      endUrl
    };
    return this;
  }

  withPreRoll(adDecisionServerUrl: string, duration: number): MediaTailorConfigBuilder {
    this.config.preRolladDecisionServerUrl = adDecisionServerUrl;
    this.config.preRollDuration = duration;
    return this;
  }

  withAvailSuppression(
    mode: "OFF" | "BEHIND_LIVE_EDGE" | "AFTER_LIVE_EDGE",
    value: string,
    fillPolicy: "PARTIAL_AVAIL" | "FULL_AVAIL_ONLY"
  ): MediaTailorConfigBuilder {
    this.config.availSuppression = {
      mode,
      value,
      fillPolicy
    };
    return this;
  }

  withHlsTranscodeProfile(profileName: string): MediaTailorConfigBuilder {
    if (!this.config.transcodeProfiles) {
      this.config.transcodeProfiles = { hlsCmaf: profileName };
    } else {
      this.config.transcodeProfiles.hlsCmaf = profileName;
    }
    return this;
  }

  withDashTranscodeProfile(profileName: string): MediaTailorConfigBuilder {
    if (!this.config.transcodeProfiles) {
      this.config.transcodeProfiles = { dashCmaf: profileName };
    } else {
      this.config.transcodeProfiles.dashCmaf = profileName;
    }
    return this;
  }

  withTranscodeProfiles(hlsCmaf: string, dashCmaf: string): MediaTailorConfigBuilder {
    this.config.transcodeProfiles = {
      hlsCmaf,
      dashCmaf
    };
    return this;
  }

  build(): IEventGroupMediaTailorConfig {
    return { ...this.config };
  }
}

/**
 * Builder class for creating complete EventGroup test configurations
 */
export class EventGroupConfigBuilder {
  private config: IEventGroupConfig;

  constructor() {
    this.config = {
      cloudFront: {
        nominalSegmentLength: 4,
        s3LoggingEnabled: false,
        enableIpv6: true
      },
      mediaTailor: []
    };
  }

  withCloudFrontConfig(
    nominalSegmentLength: number,
    s3LoggingEnabled: boolean = false,
    enableIpv6: boolean = true
  ): EventGroupConfigBuilder {
    this.config.cloudFront = {
      nominalSegmentLength,
      s3LoggingEnabled,
      enableIpv6
    };
    return this;
  }

  withOriginShield(enabled: boolean, region?: string): EventGroupConfigBuilder {
    this.config.cloudFront.enableOriginShield = enabled;
    if (region) {
      this.config.cloudFront.originShieldRegion = region;
    }
    return this;
  }

  withTokenizationFunction(arn: string): EventGroupConfigBuilder {
    this.config.cloudFront.tokenizationFunctionArn = arn;
    return this;
  }

  withKeyGroups(keyGroupIds: string[]): EventGroupConfigBuilder {
    this.config.cloudFront.keyGroupId = keyGroupIds;
    return this;
  }

  withMediaTailorConfig(config: IEventGroupMediaTailorConfig): EventGroupConfigBuilder {
    this.config.mediaTailor.push(config);
    return this;
  }

  withMediaTailorConfigs(configs: IEventGroupMediaTailorConfig[]): EventGroupConfigBuilder {
    this.config.mediaTailor = [...configs];
    return this;
  }

  addSimpleMediaTailorConfig(name: string): EventGroupConfigBuilder {
    const config = new MediaTailorConfigBuilder(name).build();
    this.config.mediaTailor.push(config);
    return this;
  }

  build(): IEventGroupConfig {
    return { ...this.config };
  }
}

/**
 * Factory class for creating common test configurations
 */
export class MediaTailorTestConfigs {
  static singleConfiguration(): IEventGroupConfig {
    return new EventGroupConfigBuilder()
      .addSimpleMediaTailorConfig("primary")
      .build();
  }

  static dualConfiguration(): IEventGroupConfig {
    return new EventGroupConfigBuilder()
      .addSimpleMediaTailorConfig("primary")
      .addSimpleMediaTailorConfig("secondary")
      .build();
  }

  static hlsOnlyConfiguration(): IEventGroupConfig {
    const hlsConfig = new MediaTailorConfigBuilder("hls-only")
      .withHlsTranscodeProfile("hls-profile-v1")
      .build();

    return new EventGroupConfigBuilder()
      .withMediaTailorConfig(hlsConfig)
      .build();
  }

  static dashOnlyConfiguration(): IEventGroupConfig {
    const dashConfig = new MediaTailorConfigBuilder("dash-only")
      .withDashTranscodeProfile("dash-profile-v1")
      .build();

    return new EventGroupConfigBuilder()
      .withMediaTailorConfig(dashConfig)
      .build();
  }

  static advancedConfiguration(): IEventGroupConfig {
    const advancedConfig = new MediaTailorConfigBuilder("advanced")
      .withAdMarkerPassthrough(true)
      .withPersonalizationThreshold(10)
      .withBumpers("https://bumper.example.com/start.mov", "https://bumper.example.com/end.mov")
      .withPreRoll("https://preroll.example.com", 30)
      .withAvailSuppression("BEHIND_LIVE_EDGE", "00:01:00", "PARTIAL_AVAIL")
      .withTranscodeProfiles("advanced-hls", "advanced-dash")
      .build();

    return new EventGroupConfigBuilder()
      .withCloudFrontConfig(6, true, false)
      .withOriginShield(true, "us-east-1")
      .withMediaTailorConfig(advancedConfig)
      .build();
  }

  static multipleConfigurationsWithDifferentProfiles(): IEventGroupConfig {
    const hlsConfig = new MediaTailorConfigBuilder("hls")
      .withHlsTranscodeProfile("hls-profile-v1")
      .withContentSegmentUrlPrefix("[player_params.content_segment_prefix]")
      .withAdSegmentUrlPrefix("[player_params.ad_segment_prefix]")
      .build();

    const dashConfig = new MediaTailorConfigBuilder("dash")
      .withDashTranscodeProfile("dash-profile-v1")
      .withContentSegmentUrlPrefix("[player_params.content_segment_prefix]")
      .withAdSegmentUrlPrefix("[player_params.ad_segment_prefix]")
      .build();

    const bothConfig = new MediaTailorConfigBuilder("both")
      .withTranscodeProfiles("both-hls-profile", "both-dash-profile")
      .withContentSegmentUrlPrefix("[player_params.content_segment_prefix]")
      .withAdSegmentUrlPrefix("[player_params.ad_segment_prefix]")
      .build();

    return new EventGroupConfigBuilder()
      .withMediaTailorConfigs([hlsConfig, dashConfig, bothConfig])
      .build();
  }
}