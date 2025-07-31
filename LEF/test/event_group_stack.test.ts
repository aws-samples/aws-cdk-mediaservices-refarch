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
import { Template } from "aws-cdk-lib/assertions";
import { LefEventGroupStack } from "../lib/event_group/lef_event_group_stack";

// Mock the loadConfig function
jest.mock("../lib/config/configValidator", () => ({
  loadConfig: jest.fn().mockImplementation((configFilePath, configKey) => {
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
          adMarkerPassthrough: false,
          slateAdUrl: "https://example.com/slate.mov",
        },
        {
          name: "secondary",
          adDecisionServerUrl: "https://example.com/ads2",
          contentSegmentUrlPrefix: "[player_params.content_segment_prefix]",
          adSegmentUrlPrefix: "[player_params.ad_segment_prefix]",
          adMarkerPassthrough: false,
          slateAdUrl: "https://example.com/slate2.mov",
        }
      ],
    };
  }),
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

// Mock MediaTailor class
jest.mock("../lib/event_group/mediatailor", () => {
  return {
    MediaTailor: jest.fn().mockImplementation(() => {
      return {
        configEMT: {},
        hlsEndpoint: "https://example.com/hls",
        dashEndpoint: "https://example.com/dash",
        sessionEndpoint: "https://example.com/session",
        configHostname: "example.com",
        playbackConfigurationArn: "arn:aws:mediatailor:us-west-2:123456789012:playbackConfiguration/test",
        configurationName: "test-config",
        node: {
          addDependency: jest.fn()
        }
      };
    })
  };
});

describe("LefEventGroupStack", () => {
  test("creates multiple MediaTailor configurations", () => {
    // Arrange
    const app = new cdk.App({
      context: {
        "LiveEventFrameworkVersion": "1.0.0"
      }
    });
    
    // Act
    const stack = new LefEventGroupStack(app, "TestEventGroupStack", {}, "path/to/config");
    
    // Assert
    // Verify that MediaTailor is called twice
    expect(require("../lib/event_group/mediatailor").MediaTailor).toHaveBeenCalledTimes(2);
    
    // Verify that CloudFront is called
    expect(require("../lib/event_group/cloudfront").CloudFront).toHaveBeenCalledTimes(1);
  });
  
  test("validates MediaTailor configuration names", () => {
    // Arrange
    const app = new cdk.App();
    
    // Mock the loadConfig function to return invalid configuration
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
            adMarkerPassthrough: false,
            slateAdUrl: "https://example.com/slate.mov",
          },
          {
            name: "primary", // Duplicate name
            adDecisionServerUrl: "https://example.com/ads2",
            contentSegmentUrlPrefix: "[player_params.content_segment_prefix]",
            adSegmentUrlPrefix: "[player_params.ad_segment_prefix]",
            adMarkerPassthrough: false,
            slateAdUrl: "https://example.com/slate2.mov",
          }
        ],
      };
    });
    
    // Act & Assert
    expect(() => {
      new LefEventGroupStack(app, "TestEventGroupStack", {}, "path/to/config");
    }).toThrow("All named MediaTailor configurations must have unique names");
  });

  test("allows single MediaTailor configuration with no name", () => {
    // Arrange
    const app = new cdk.App();
    
    // Mock the loadConfig function to return configuration with single unnamed config
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
            adDecisionServerUrl: "https://example.com/ads",
            contentSegmentUrlPrefix: "[player_params.content_segment_prefix]",
            adSegmentUrlPrefix: "[player_params.ad_segment_prefix]",
            adMarkerPassthrough: false,
            slateAdUrl: "https://example.com/slate.mov",
          }
        ],
      };
    });
    
    // Act & Assert - should not throw
    expect(() => {
      new LefEventGroupStack(app, "TestEventGroupStack", {}, "path/to/config");
    }).not.toThrow();
  });

  test("allows multiple MediaTailor configurations with one unnamed", () => {
    // Arrange
    const app = new cdk.App();
    
    // Mock the loadConfig function
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
            // No name for first config
            adDecisionServerUrl: "https://example.com/ads",
            contentSegmentUrlPrefix: "[player_params.content_segment_prefix]",
            adSegmentUrlPrefix: "[player_params.ad_segment_prefix]",
            adMarkerPassthrough: false,
            slateAdUrl: "https://example.com/slate.mov",
          },
          {
            name: "secondary",
            adDecisionServerUrl: "https://example.com/ads2",
            contentSegmentUrlPrefix: "[player_params.content_segment_prefix]",
            adSegmentUrlPrefix: "[player_params.ad_segment_prefix]",
            adMarkerPassthrough: false,
            slateAdUrl: "https://example.com/slate2.mov",
          }
        ],
      };
    });
    
    // Act & Assert - should not throw
    expect(() => {
      new LefEventGroupStack(app, "TestEventGroupStack", {}, "path/to/config");
    }).not.toThrow();
  });

  test("rejects multiple MediaTailor configurations with multiple unnamed", () => {
    // Arrange
    const app = new cdk.App();
    
    // Mock the loadConfig function
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
            // No name for first config
            adDecisionServerUrl: "https://example.com/ads",
            contentSegmentUrlPrefix: "[player_params.content_segment_prefix]",
            adSegmentUrlPrefix: "[player_params.ad_segment_prefix]",
            adMarkerPassthrough: false,
            slateAdUrl: "https://example.com/slate.mov",
          },
          {
            // No name for second config
            adDecisionServerUrl: "https://example.com/ads2",
            contentSegmentUrlPrefix: "[player_params.content_segment_prefix]",
            adSegmentUrlPrefix: "[player_params.ad_segment_prefix]",
            adMarkerPassthrough: false,
            slateAdUrl: "https://example.com/slate2.mov",
          }
        ],
      };
    });
    
    // Act & Assert
    expect(() => {
      new LefEventGroupStack(app, "TestEventGroupStack", {}, "path/to/config");
    }).toThrow("Only one MediaTailor configuration can have an undefined or empty name");
  });

  test("validates MediaTailor configuration name characters", () => {
    // Arrange
    const app = new cdk.App();
    
    // Mock the loadConfig function
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
            name: "invalid@name", // Invalid characters
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
    }).toThrow("MediaTailor configuration name 'invalid@name' contains invalid characters");
  });
  
  test("validates at least one MediaTailor configuration exists", () => {
    // Arrange
    const app = new cdk.App();
    
    // Mock the loadConfig function to return invalid configuration
    jest.requireMock("../lib/config/configValidator").loadConfig.mockImplementationOnce(() => {
      return {
        cloudFront: {
          nominalSegmentLength: 4,
          s3LoggingEnabled: true,
          enableIpv6: true,
          tokenizationFunctionArn: "",
        },
        mediaTailor: [], // Empty array
      };
    });
    
    // Act & Assert
    expect(() => {
      new LefEventGroupStack(app, "TestEventGroupStack", {}, "path/to/config");
    }).toThrow("At least one MediaTailor configuration must be provided");
  });
});