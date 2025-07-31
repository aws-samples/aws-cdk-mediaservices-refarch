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

import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { MediaTailor } from "../lib/event_group/mediatailor";
import { IEventGroupMediaTailorConfig } from "../lib/event_group/eventGroupConfigInterface";

describe("Multiple MediaTailor Playback Configurations", () => {
  let app: App;
  let stack: Stack;

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, "TestStack");
  });

  describe("Configuration Name Generation", () => {
    it("should generate correct configuration name with suffix", () => {
      const config: IEventGroupMediaTailorConfig = {
        name: "primary",
        adDecisionServerUrl: "https://example.com/ads",
        contentSegmentUrlPrefix: "/",
        adSegmentUrlPrefix: "/",
        slateAdUrl: "https://example.com/slate.mov"
      };

      const mediaTailor = new MediaTailor(stack, "TestMediaTailor", {
        configurationName: "test-config",
        configurationNameSuffix: "suffix",
        configuration: config,
        originHostname: "example.com"
      });

      expect(mediaTailor.configurationName).toBe("test-config-primary");
    });

    it("should use base name when no suffix provided", () => {
      const config: IEventGroupMediaTailorConfig = {
        adDecisionServerUrl: "https://example.com/ads",
        contentSegmentUrlPrefix: "/",
        adSegmentUrlPrefix: "/",
        slateAdUrl: "https://example.com/slate.mov"
      };

      const mediaTailor = new MediaTailor(stack, "TestMediaTailor", {
        configurationName: "test-config",
        configuration: config,
        originHostname: "example.com"
      });

      expect(mediaTailor.configurationName).toBe("test-config");
    });
  });

  describe("Transcode Profile Configuration", () => {
    it("should configure HLS-only transcode profile", () => {
      const config: IEventGroupMediaTailorConfig = {
        name: "hls-only",
        adDecisionServerUrl: "https://example.com/ads",
        contentSegmentUrlPrefix: "/",
        adSegmentUrlPrefix: "/",
        slateAdUrl: "https://example.com/slate.mov",
        transcodeProfiles: {
          hlsCmaf: "hls-profile-name"
        }
      };

      new MediaTailor(stack, "TestMediaTailor", {
        configurationName: "test-config",
        configuration: config,
        originHostname: "example.com"
      });

      const template = Template.fromStack(stack);
      
      template.hasResourceProperties("AWS::MediaTailor::PlaybackConfiguration", {
        TranscodeProfileName: "[player_params.transcode_profile]"
      });
    });

    it("should configure DASH-only transcode profile", () => {
      const config: IEventGroupMediaTailorConfig = {
        name: "dash-only",
        adDecisionServerUrl: "https://example.com/ads",
        contentSegmentUrlPrefix: "/",
        adSegmentUrlPrefix: "/",
        slateAdUrl: "https://example.com/slate.mov",
        transcodeProfiles: {
          dashCmaf: "dash-profile-name"
        }
      };

      new MediaTailor(stack, "TestMediaTailor", {
        configurationName: "test-config",
        configuration: config,
        originHostname: "example.com"
      });

      const template = Template.fromStack(stack);
      
      template.hasResourceProperties("AWS::MediaTailor::PlaybackConfiguration", {
        TranscodeProfileName: "[player_params.transcode_profile]"
      });
    });

    it("should handle empty transcode profiles", () => {
      const config: IEventGroupMediaTailorConfig = {
        name: "no-profiles",
        adDecisionServerUrl: "https://example.com/ads",
        contentSegmentUrlPrefix: "/",
        adSegmentUrlPrefix: "/",
        slateAdUrl: "https://example.com/slate.mov",
        transcodeProfiles: {
          hlsCmaf: "",
          dashCmaf: ""
        }
      };

      new MediaTailor(stack, "TestMediaTailor", {
        configurationName: "test-config",
        configuration: config,
        originHostname: "example.com"
      });

      const template = Template.fromStack(stack);
      
      // The current implementation sets transcode profile even for empty strings
      // This test verifies the current behavior
      template.hasResourceProperties("AWS::MediaTailor::PlaybackConfiguration", {
        TranscodeProfileName: "[player_params.transcode_profile]"
      });
    });
  });

  describe("Advanced Configuration Options", () => {
    it("should configure bumpers correctly", () => {
      const config: IEventGroupMediaTailorConfig = {
        name: "with-bumpers",
        adDecisionServerUrl: "https://example.com/ads",
        contentSegmentUrlPrefix: "/",
        adSegmentUrlPrefix: "/",
        slateAdUrl: "https://example.com/slate.mov",
        bumper: {
          startUrl: "https://example.com/start-bumper.mov",
          endUrl: "https://example.com/end-bumper.mov"
        }
      };

      new MediaTailor(stack, "TestMediaTailor", {
        configurationName: "test-config",
        configuration: config,
        originHostname: "example.com"
      });

      const template = Template.fromStack(stack);
      
      template.hasResourceProperties("AWS::MediaTailor::PlaybackConfiguration", {
        Bumper: {
          StartUrl: "https://example.com/start-bumper.mov",
          EndUrl: "https://example.com/end-bumper.mov"
        }
      });
    });

    it("should configure avail suppression", () => {
      const config: IEventGroupMediaTailorConfig = {
        name: "with-avail-suppression",
        adDecisionServerUrl: "https://example.com/ads",
        contentSegmentUrlPrefix: "/",
        adSegmentUrlPrefix: "/",
        slateAdUrl: "https://example.com/slate.mov",
        availSuppression: {
          mode: "BEHIND_LIVE_EDGE",
          value: "00:00:30",
          fillPolicy: "PARTIAL_AVAIL"
        }
      };

      new MediaTailor(stack, "TestMediaTailor", {
        configurationName: "test-config",
        configuration: config,
        originHostname: "example.com"
      });

      const template = Template.fromStack(stack);
      
      template.hasResourceProperties("AWS::MediaTailor::PlaybackConfiguration", {
        AvailSuppression: {
          Mode: "BEHIND_LIVE_EDGE",
          Value: "00:00:30",
          FillPolicy: "PARTIAL_AVAIL"
        }
      });
    });

    it("should configure pre-roll settings", () => {
      const config: IEventGroupMediaTailorConfig = {
        name: "with-preroll",
        adDecisionServerUrl: "https://example.com/ads",
        contentSegmentUrlPrefix: "/",
        adSegmentUrlPrefix: "/",
        slateAdUrl: "https://example.com/slate.mov",
        preRolladDecisionServerUrl: "https://example.com/preroll-ads",
        preRollDuration: 30
      };

      new MediaTailor(stack, "TestMediaTailor", {
        configurationName: "test-config",
        configuration: config,
        originHostname: "example.com"
      });

      const template = Template.fromStack(stack);
      
      template.hasResourceProperties("AWS::MediaTailor::PlaybackConfiguration", {
        LivePreRollConfiguration: {
          AdDecisionServerUrl: "https://example.com/preroll-ads",
          MaxDurationSeconds: 30
        }
      });
    });

    it("should configure personalization threshold", () => {
      const config: IEventGroupMediaTailorConfig = {
        name: "with-personalization",
        adDecisionServerUrl: "https://example.com/ads",
        contentSegmentUrlPrefix: "/",
        adSegmentUrlPrefix: "/",
        slateAdUrl: "https://example.com/slate.mov",
        personalizationThreshold: 5
      };

      new MediaTailor(stack, "TestMediaTailor", {
        configurationName: "test-config",
        configuration: config,
        originHostname: "example.com"
      });

      const template = Template.fromStack(stack);
      
      template.hasResourceProperties("AWS::MediaTailor::PlaybackConfiguration", {
        PersonalizationThresholdSeconds: 5
      });
    });
  });

  describe("Ad Marker Passthrough", () => {
    it("should enable ad marker passthrough when configured", () => {
      const config: IEventGroupMediaTailorConfig = {
        name: "with-passthrough",
        adDecisionServerUrl: "https://example.com/ads",
        contentSegmentUrlPrefix: "/",
        adSegmentUrlPrefix: "/",
        slateAdUrl: "https://example.com/slate.mov",
        adMarkerPassthrough: true
      };

      new MediaTailor(stack, "TestMediaTailor", {
        configurationName: "test-config",
        configuration: config,
        originHostname: "example.com"
      });

      const template = Template.fromStack(stack);
      
      template.hasResourceProperties("AWS::MediaTailor::PlaybackConfiguration", {
        ManifestProcessingRules: {
          AdMarkerPassthrough: {
            Enabled: true
          }
        }
      });
    });

    it("should disable ad marker passthrough by default", () => {
      const config: IEventGroupMediaTailorConfig = {
        name: "default-passthrough",
        adDecisionServerUrl: "https://example.com/ads",
        contentSegmentUrlPrefix: "/",
        adSegmentUrlPrefix: "/",
        slateAdUrl: "https://example.com/slate.mov"
      };

      new MediaTailor(stack, "TestMediaTailor", {
        configurationName: "test-config",
        configuration: config,
        originHostname: "example.com"
      });

      const template = Template.fromStack(stack);
      
      template.hasResourceProperties("AWS::MediaTailor::PlaybackConfiguration", {
        ManifestProcessingRules: {
          AdMarkerPassthrough: {
            Enabled: false
          }
        }
      });
    });
  });

  describe("Output Properties", () => {
    it("should expose correct endpoint properties", () => {
      const config: IEventGroupMediaTailorConfig = {
        name: "endpoint-test",
        adDecisionServerUrl: "https://example.com/ads",
        contentSegmentUrlPrefix: "/",
        adSegmentUrlPrefix: "/",
        slateAdUrl: "https://example.com/slate.mov"
      };

      const mediaTailor = new MediaTailor(stack, "TestMediaTailor", {
        configurationName: "test-config",
        configuration: config,
        originHostname: "example.com"
      });

      expect(mediaTailor.hlsEndpoint).toBeDefined();
      expect(mediaTailor.dashEndpoint).toBeDefined();
      expect(mediaTailor.sessionEndpoint).toBeDefined();
      expect(mediaTailor.configHostname).toBeDefined();
      expect(mediaTailor.playbackConfigurationArn).toBeDefined();
    });
  });
});