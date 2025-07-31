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
import { LefEventGroupStack } from "../lib/event_group/lef_event_group_stack";

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

// Mock CloudFront class to avoid Fn.join error
jest.mock("../lib/event_group/cloudfront", () => {
  return {
    CloudFront: jest.fn().mockImplementation(() => {
      return {
        distribution: {
          domainName: "test-distribution.cloudfront.net",
          distributionId: "TESTDISTRIBUTION"
        },
        node: {
          addDependency: jest.fn()
        }
      };
    })
  };
});

describe("LefEventGroupStack MediaTailor Configurations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock MediaTailor class
    jest.mock("../lib/event_group/mediatailor", () => {
      return {
        MediaTailor: jest.fn().mockImplementation((scope, id, props) => {
          return {
            configEMT: {},
            hlsEndpoint: "https://example.com/hls",
            dashEndpoint: "https://example.com/dash",
            sessionEndpoint: "https://example.com/session",
            configHostname: "example.com",
            playbackConfigurationArn: `arn:aws:mediatailor:us-west-2:123456789012:playbackConfiguration/${props.configuration.name}`,
            configurationName: props.configurationName + (props.configurationNameSuffix ? `-${props.configurationNameSuffix}` : ""),
            node: {
              addDependency: jest.fn()
            }
          };
        })
      };
    });
  });

  test("validates MediaTailor configuration name format", () => {
    // Arrange
    const app = new cdk.App();
    
    // Mock the loadConfig function to return invalid configuration with special characters
    jest.requireMock("../lib/config/configValidator").loadConfig.mockImplementationOnce(() => {
      return {
        cloudFront: {
          nominalSegmentLength: 4,
          s3LoggingEnabled: true,
          enableIpv6: true,
          tokenizationFunctionArn: "",
        },
        mediaTailor: [
          {
            name: "invalid@name", // Invalid name with special character
            adDecisionServerUrl: "https://example.com/ads",
            contentSegmentUrlPrefix: "[player_params.content_segment_prefix]",
            adSegmentUrlPrefix: "[player_params.ad_segment_prefix]",
            adMarkerPassthrough: false,
            slateAdUrl: "https://example.com/slate.mov",
          }
        ],
      };
    });
    
    // Act & Assert
    expect(() => {
      new LefEventGroupStack(app, "TestEventGroupStack", {}, "path/to/config");
    }).toThrow(/MediaTailor configuration name.*contains invalid characters/);
  });

  test("creates stack with multiple MediaTailor configurations with different transcode profiles", () => {
    // Arrange
    const app = new cdk.App({
      context: {
        "LiveEventFrameworkVersion": "1.0.0"
      }
    });
    
    // Mock the loadConfig function to return configuration with multiple MediaTailor configs
    jest.requireMock("../lib/config/configValidator").loadConfig.mockImplementationOnce(() => {
      return {
        cloudFront: {
          nominalSegmentLength: 4,
          s3LoggingEnabled: true,
          enableIpv6: true,
          tokenizationFunctionArn: "",
        },
        mediaTailor: [
          {
            name: "hls",
            adDecisionServerUrl: "https://example.com/ads",
            contentSegmentUrlPrefix: "[player_params.content_segment_prefix]",
            adSegmentUrlPrefix: "[player_params.ad_segment_prefix]",
            adMarkerPassthrough: false,
            slateAdUrl: "https://example.com/slate.mov",
            transcodeProfiles: {
              hlsCmaf: "hls-profile",
              dashCmaf: ""
            }
          },
          {
            name: "dash",
            adDecisionServerUrl: "https://example.com/ads2",
            contentSegmentUrlPrefix: "[player_params.content_segment_prefix]",
            adSegmentUrlPrefix: "[player_params.ad_segment_prefix]",
            adMarkerPassthrough: false,
            slateAdUrl: "https://example.com/slate2.mov",
            transcodeProfiles: {
              hlsCmaf: "",
              dashCmaf: "dash-profile"
            }
          }
        ],
      };
    });
    
    // Act
    new LefEventGroupStack(app, "TestEventGroupStack", {}, "path/to/config");
    
    // Assert
    // Verify that CloudFront is called
    expect(require("../lib/event_group/cloudfront").CloudFront).toHaveBeenCalledTimes(1);
  });

  test("creates stack with MediaTailor configurations with bumpers and avail suppression", () => {
    // Arrange
    const app = new cdk.App({
      context: {
        "LiveEventFrameworkVersion": "1.0.0"
      }
    });
    
    // Reset MediaTailor mock to track calls
    const MediaTailorMock = jest.fn().mockImplementation((scope, id, props) => {
      return {
        configEMT: {},
        hlsEndpoint: "https://example.com/hls",
        dashEndpoint: "https://example.com/dash",
        sessionEndpoint: "https://example.com/session",
        configHostname: "example.com",
        playbackConfigurationArn: `arn:aws:mediatailor:us-west-2:123456789012:playbackConfiguration/${props.configuration.name}`,
        configurationName: props.configurationName + (props.configurationNameSuffix ? `-${props.configurationNameSuffix}` : ""),
        node: {
          addDependency: jest.fn()
        }
      };
    });
    
    jest.doMock("../lib/event_group/mediatailor", () => ({
      MediaTailor: MediaTailorMock
    }), { virtual: true });
    
    // Mock the loadConfig function to return configuration with bumpers and avail suppression
    jest.requireMock("../lib/config/configValidator").loadConfig.mockImplementationOnce(() => {
      return {
        cloudFront: {
          nominalSegmentLength: 4,
          s3LoggingEnabled: true,
          enableIpv6: true,
          tokenizationFunctionArn: "",
        },
        mediaTailor: [
          {
            name: "primary",
            adDecisionServerUrl: "https://example.com/ads",
            contentSegmentUrlPrefix: "[player_params.content_segment_prefix]",
            adSegmentUrlPrefix: "[player_params.ad_segment_prefix]",
            adMarkerPassthrough: true,
            slateAdUrl: "https://example.com/slate.mov",
            bumper: {
              startUrl: "https://example.com/bumper-start.mov",
              endUrl: "https://example.com/bumper-end.mov",
            },
            availSuppression: {
              mode: "BEHIND_LIVE_EDGE",
              value: "00:00:30",
              fillPolicy: "PARTIAL_AVAIL"
            },
            preRolladDecisionServerUrl: "https://example.com/preroll",
            preRollDuration: 15,
            personalizationThreshold: 5
          },
          {
            name: "secondary",
            adDecisionServerUrl: "https://example.com/ads2",
            contentSegmentUrlPrefix: "/",
            adSegmentUrlPrefix: "/",
            adMarkerPassthrough: false,
            slateAdUrl: "https://example.com/slate2.mov"
          }
        ],
      };
    });
    
    // Act
    new LefEventGroupStack(app, "TestEventGroupStack", {}, "path/to/config");
    
    // Assert
    // Verify that CloudFront is called
    expect(require("../lib/event_group/cloudfront").CloudFront).toHaveBeenCalledTimes(1);
  });
});