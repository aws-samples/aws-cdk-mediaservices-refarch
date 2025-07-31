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

import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { LefEventGroupStack } from "../lib/event_group/lef_event_group_stack";
import { MediaTailorTestConfigs, MediaTailorConfigBuilder, EventGroupConfigBuilder } from "./utils/mediatailor-config-builder";

// Mock the loadConfig function
jest.mock("../lib/config/configValidator", () => ({
  loadConfig: jest.fn(),
  ConfigurationError: class ConfigurationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "ConfigurationError";
    }
  }
}));

describe("MediaTailor Configuration Scenarios", () => {
  let app: App;
  let mockLoadConfig: jest.MockedFunction<any>;

  beforeEach(() => {
    app = new App({
      context: {
        "LiveEventFrameworkVersion": "1.0.4"
      }
    });
    mockLoadConfig = jest.requireMock("../lib/config/configValidator").loadConfig;
    jest.clearAllMocks();
  });

  describe("Common Deployment Scenarios", () => {
    it("should handle single MediaTailor configuration deployment", () => {
      const config = MediaTailorTestConfigs.singleConfiguration();
      mockLoadConfig.mockReturnValue(config);

      const stack = new LefEventGroupStack(app, "SingleConfigStack", {}, "test-config");
      const template = Template.fromStack(stack);

      template.resourceCountIs("AWS::MediaTailor::PlaybackConfiguration", 1);
    });

    it("should handle dual MediaTailor configuration deployment", () => {
      const config = MediaTailorTestConfigs.dualConfiguration();
      mockLoadConfig.mockReturnValue(config);

      const stack = new LefEventGroupStack(app, "DualConfigStack", {}, "test-config");
      const template = Template.fromStack(stack);

      template.resourceCountIs("AWS::MediaTailor::PlaybackConfiguration", 2);
    });

    it("should handle HLS-only configuration", () => {
      const config = MediaTailorTestConfigs.hlsOnlyConfiguration();
      mockLoadConfig.mockReturnValue(config);

      const stack = new LefEventGroupStack(app, "HlsOnlyStack", {}, "test-config");
      const template = Template.fromStack(stack);

      template.resourceCountIs("AWS::MediaTailor::PlaybackConfiguration", 1);
    });

    it("should handle DASH-only configuration", () => {
      const config = MediaTailorTestConfigs.dashOnlyConfiguration();
      mockLoadConfig.mockReturnValue(config);

      const stack = new LefEventGroupStack(app, "DashOnlyStack", {}, "test-config");
      const template = Template.fromStack(stack);

      template.resourceCountIs("AWS::MediaTailor::PlaybackConfiguration", 1);
    });
  });

  describe("Advanced Feature Scenarios", () => {
    it("should handle multiple configurations with different profiles", () => {
      const config = MediaTailorTestConfigs.multipleConfigurationsWithDifferentProfiles();
      mockLoadConfig.mockReturnValue(config);

      const stack = new LefEventGroupStack(app, "MultiProfileStack", {}, "test-config");
      const template = Template.fromStack(stack);

      template.resourceCountIs("AWS::MediaTailor::PlaybackConfiguration", 3);
    });
  });

  describe("Custom Configuration Scenarios", () => {
    it("should handle live sports configuration", () => {
      const sportsConfig = new MediaTailorConfigBuilder("sports")
        .withAdDecisionServerUrl("https://sports-ads.example.com")
        .withPersonalizationThreshold(3)
        .withAvailSuppression("BEHIND_LIVE_EDGE", "00:00:15", "FULL_AVAIL_ONLY")
        .build();

      const config = new EventGroupConfigBuilder()
        .withCloudFrontConfig(2, true, true)
        .withMediaTailorConfig(sportsConfig)
        .build();

      mockLoadConfig.mockReturnValue(config);

      const stack = new LefEventGroupStack(app, "SportsStack", {}, "test-config");
      const template = Template.fromStack(stack);

      template.resourceCountIs("AWS::MediaTailor::PlaybackConfiguration", 1);
    });

    it("should handle news broadcast configuration", () => {
      const newsConfig = new MediaTailorConfigBuilder("news")
        .withAdDecisionServerUrl("https://news-ads.example.com")
        .withAdMarkerPassthrough(true)
        .withPreRoll("https://news-preroll.example.com", 15)
        .withBumpers("https://news-bumper-start.example.com", "https://news-bumper-end.example.com")
        .build();

      const config = new EventGroupConfigBuilder()
        .withCloudFrontConfig(4, false, true)
        .withMediaTailorConfig(newsConfig)
        .build();

      mockLoadConfig.mockReturnValue(config);

      const stack = new LefEventGroupStack(app, "NewsStack", {}, "test-config");
      const template = Template.fromStack(stack);

      template.resourceCountIs("AWS::MediaTailor::PlaybackConfiguration", 1);
    });

    it("should handle multi-region failover configuration", () => {
      const primaryConfig = new MediaTailorConfigBuilder("primary")
        .withAdDecisionServerUrl("https://primary-ads.example.com")
        .withSlateAdUrl("https://primary-slate.example.com/slate.mov")
        .build();

      const failoverConfig = new MediaTailorConfigBuilder("failover")
        .withAdDecisionServerUrl("https://failover-ads.example.com")
        .withSlateAdUrl("https://failover-slate.example.com/slate.mov")
        .build();

      const config = new EventGroupConfigBuilder()
        .withCloudFrontConfig(4, true, true)
        .withOriginShield(true, "us-east-1")
        .withMediaTailorConfigs([primaryConfig, failoverConfig])
        .build();

      mockLoadConfig.mockReturnValue(config);

      const stack = new LefEventGroupStack(app, "FailoverStack", {}, "test-config");
      const template = Template.fromStack(stack);

      template.resourceCountIs("AWS::MediaTailor::PlaybackConfiguration", 2);
    });
  });

  describe("Edge Cases and Error Scenarios", () => {
    it("should handle maximum number of configurations", () => {
      const configs = [];
      for (let i = 1; i <= 5; i++) {
        configs.push(new MediaTailorConfigBuilder(`config-${i}`).build());
      }

      const config = new EventGroupConfigBuilder()
        .withMediaTailorConfigs(configs)
        .build();

      mockLoadConfig.mockReturnValue(config);

      const stack = new LefEventGroupStack(app, "MaxConfigStack", {}, "test-config");
      const template = Template.fromStack(stack);

      template.resourceCountIs("AWS::MediaTailor::PlaybackConfiguration", 5);
      template.resourceCountIs("AWS::CloudFront::Distribution", 1);
    });
  });
});