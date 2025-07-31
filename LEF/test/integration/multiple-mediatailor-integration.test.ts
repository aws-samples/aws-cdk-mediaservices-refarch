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
import { LefEventGroupStack } from "../../lib/event_group/lef_event_group_stack";
import { IEventGroupConfig } from "../../lib/event_group/eventGroupConfigInterface";

// Mock the loadConfig function
jest.mock("../../lib/config/configValidator", () => ({
  loadConfig: jest.fn(),
  ConfigurationError: class ConfigurationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "ConfigurationError";
    }
  }
}));

describe("Multiple MediaTailor Integration Tests", () => {
  let app: App;
  let mockLoadConfig: jest.MockedFunction<any>;

  beforeEach(() => {
    app = new App({
      context: {
        "LiveEventFrameworkVersion": "1.0.4"
      }
    });
    mockLoadConfig = jest.requireMock("../../lib/config/configValidator").loadConfig;
    jest.clearAllMocks();
  });

  describe("Stack Creation with Multiple Configurations", () => {
    it("should create stack with two MediaTailor configurations", () => {
      const config: IEventGroupConfig = {
        cloudFront: {
          nominalSegmentLength: 4,
          s3LoggingEnabled: false,
          enableIpv6: true
        },
        mediaTailor: [
          {
            name: "primary",
            adDecisionServerUrl: "https://ads.example.com/primary",
            contentSegmentUrlPrefix: "/",
            adSegmentUrlPrefix: "/",
            slateAdUrl: "https://slate.example.com/primary.mov"
          },
          {
            name: "secondary",
            adDecisionServerUrl: "https://ads.example.com/secondary", 
            contentSegmentUrlPrefix: "/",
            adSegmentUrlPrefix: "/",
            slateAdUrl: "https://slate.example.com/secondary.mov"
          }
        ]
      };

      mockLoadConfig.mockReturnValue(config);

      const stack = new LefEventGroupStack(app, "TestEventGroupStack", {}, "test-config");
      const template = Template.fromStack(stack);

      // Verify two MediaTailor configurations are created
      template.resourceCountIs("AWS::MediaTailor::PlaybackConfiguration", 2);
    });

    it("should create CloudFront distribution with multiple origins", () => {
      const config: IEventGroupConfig = {
        cloudFront: {
          nominalSegmentLength: 6,
          s3LoggingEnabled: true,
          enableIpv6: false,
          enableOriginShield: true,
          originShieldRegion: "us-east-1"
        },
        mediaTailor: [
          {
            name: "hls",
            adDecisionServerUrl: "https://ads.example.com/hls",
            contentSegmentUrlPrefix: "/",
            adSegmentUrlPrefix: "/",
            slateAdUrl: "https://slate.example.com/hls.mov"
          },
          {
            name: "dash",
            adDecisionServerUrl: "https://ads.example.com/dash",
            contentSegmentUrlPrefix: "/",
            adSegmentUrlPrefix: "/",
            slateAdUrl: "https://slate.example.com/dash.mov"
          }
        ]
      };

      mockLoadConfig.mockReturnValue(config);

      const stack = new LefEventGroupStack(app, "TestEventGroupStack", {}, "test-config");
      const template = Template.fromStack(stack);

      // Verify CloudFront distribution is created
      template.resourceCountIs("AWS::CloudFront::Distribution", 1);
    });
  });

  describe("Configuration Validation", () => {
    it("should reject invalid configuration names", () => {
      const config: IEventGroupConfig = {
        cloudFront: {
          nominalSegmentLength: 4,
          s3LoggingEnabled: false,
          enableIpv6: true
        },
        mediaTailor: [
          {
            name: "invalid-name!",
            adDecisionServerUrl: "https://ads.example.com",
            contentSegmentUrlPrefix: "/",
            adSegmentUrlPrefix: "/",
            slateAdUrl: "https://slate.example.com/slate.mov"
          }
        ]
      };

      mockLoadConfig.mockReturnValue(config);

      expect(() => {
        new LefEventGroupStack(app, "TestEventGroupStack", {}, "test-config");
      }).toThrow();
    });

    it("should handle empty MediaTailor configurations array", () => {
      const config: IEventGroupConfig = {
        cloudFront: {
          nominalSegmentLength: 4,
          s3LoggingEnabled: false,
          enableIpv6: true
        },
        mediaTailor: []
      };

      mockLoadConfig.mockReturnValue(config);

      expect(() => {
        new LefEventGroupStack(app, "TestEventGroupStack", {}, "test-config");
      }).toThrow();
    });
  });

  describe("Advanced Configuration Features", () => {
    it("should create configurations with advanced features", () => {
      const config: IEventGroupConfig = {
        cloudFront: {
          nominalSegmentLength: 4,
          s3LoggingEnabled: true,
          enableIpv6: false,
          enableOriginShield: true,
          originShieldRegion: "us-east-1"
        },
        mediaTailor: [
          {
            name: "advanced",
            adDecisionServerUrl: "https://ads.example.com/advanced",
            contentSegmentUrlPrefix: "/",
            adSegmentUrlPrefix: "/",
            slateAdUrl: "https://slate.example.com/advanced.mov",
            adMarkerPassthrough: true,
            personalizationThreshold: 10
          }
        ]
      };

      mockLoadConfig.mockReturnValue(config);

      const stack = new LefEventGroupStack(app, "TestEventGroupStack", {}, "test-config");
      const template = Template.fromStack(stack);

      template.resourceCountIs("AWS::MediaTailor::PlaybackConfiguration", 1);
      template.resourceCountIs("AWS::CloudFront::Distribution", 1);
    });
  });

  describe("Error Handling", () => {
    it("should handle configuration loading errors gracefully", () => {
      mockLoadConfig.mockImplementation(() => {
        throw new Error("Configuration file not found");
      });

      expect(() => {
        new LefEventGroupStack(app, "TestEventGroupStack", {}, "invalid-config");
      }).toThrow("Configuration file not found");
    });
  });
});