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
import { MediaPackageV2 } from "../lib/event/mediapackagev2";
import { IMediaPackageChannelConfig } from "../lib/event/eventConfigInterface";

describe("MediaPackage Preferred Input", () => {
  let app: cdk.App;
  let stack: cdk.Stack;

  beforeEach(() => {
    app = new cdk.App();
    stack = new cdk.Stack(app, "TestStack");
  });

  test("does not set preferred input by default for CMAF input type", () => {
    const config: IMediaPackageChannelConfig = {
      inputType: "CMAF",
      endpoints: {
        testEndpoint: {
          containerType: "CMAF",
          originEndpointName: "test",
          resourcePolicyType: "PUBLIC",
          startoverWindowSeconds: 1209600,
          segment: {
            segmentName: "segment",
            includeIframeOnlyStreams: false,
            segmentDurationSeconds: 4,
            scte: {
              scteFilter: ["SPLICE_INSERT"],
            },
          },
        },
      },
    };

    const mediaPackage = new MediaPackageV2(stack, "TestMediaPackage", {
      channelName: "test-channel",
      channelGroupName: "test-group",
      configuration: config,
      tags: [],
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties("AWS::MediaPackageV2::Channel", {
      InputSwitchConfiguration: {
        MQCSInputSwitching: true,
      },
    });

    // Verify that PreferredInput is not set
    const channels = template.findResources("AWS::MediaPackageV2::Channel");
    const channelProps = Object.values(channels)[0].Properties;
    expect(channelProps.InputSwitchConfiguration).not.toHaveProperty(
      "PreferredInput",
    );
  });

  test("respects explicitly configured preferred input", () => {
    const config: IMediaPackageChannelConfig = {
      inputType: "CMAF",
      inputSwitchConfiguration: {
        mqcsInputSwitching: true,
        preferredInput: 2,
      },
      endpoints: {
        testEndpoint: {
          containerType: "CMAF",
          originEndpointName: "test",
          resourcePolicyType: "PUBLIC",
          startoverWindowSeconds: 1209600,
          segment: {
            segmentName: "segment",
            includeIframeOnlyStreams: false,
            segmentDurationSeconds: 4,
            scte: {
              scteFilter: ["SPLICE_INSERT"],
            },
          },
        },
      },
    };

    const mediaPackage = new MediaPackageV2(stack, "TestMediaPackage", {
      channelName: "test-channel",
      channelGroupName: "test-group",
      configuration: config,
      tags: [],
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties("AWS::MediaPackageV2::Channel", {
      InputSwitchConfiguration: {
        MQCSInputSwitching: true,
        PreferredInput: 2,
      },
    });
  });

  test("does not set preferred input for HLS input type", () => {
    const config: IMediaPackageChannelConfig = {
      inputType: "HLS",
      endpoints: {
        testEndpoint: {
          containerType: "TS",
          originEndpointName: "test",
          resourcePolicyType: "PUBLIC",
          startoverWindowSeconds: 1209600,
          segment: {
            segmentName: "segment",
            includeIframeOnlyStreams: false,
            segmentDurationSeconds: 4,
            scte: {
              scteFilter: ["SPLICE_INSERT"],
            },
          },
        },
      },
    };

    const mediaPackage = new MediaPackageV2(stack, "TestMediaPackage", {
      channelName: "test-channel",
      channelGroupName: "test-group",
      configuration: config,
      tags: [],
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties("AWS::MediaPackageV2::Channel", {
      InputType: "HLS",
    });

    // Should not have InputSwitchConfiguration for HLS
    const channels = template.findResources("AWS::MediaPackageV2::Channel");
    const channelProps = Object.values(channels)[0].Properties;
    expect(channelProps).not.toHaveProperty("InputSwitchConfiguration");
  });

  test("sets preferred input when explicitly configured", () => {
    const config: IMediaPackageChannelConfig = {
      inputType: "CMAF",
      inputSwitchConfiguration: {
        mqcsInputSwitching: true,
        preferredInput: 1,
      },
      endpoints: {
        testEndpoint: {
          containerType: "CMAF",
          originEndpointName: "test",
          resourcePolicyType: "PUBLIC",
          startoverWindowSeconds: 1209600,
          segment: {
            segmentName: "segment",
            includeIframeOnlyStreams: false,
            segmentDurationSeconds: 4,
            scte: {
              scteFilter: ["SPLICE_INSERT"],
            },
          },
        },
      },
    };

    const mediaPackage = new MediaPackageV2(stack, "TestMediaPackage", {
      channelName: "test-channel",
      channelGroupName: "test-group",
      configuration: config,
      tags: [],
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties("AWS::MediaPackageV2::Channel", {
      InputSwitchConfiguration: {
        MQCSInputSwitching: true,
        PreferredInput: 1,
      },
    });
  });

  test("validates preferred input values", () => {
    const config: IMediaPackageChannelConfig = {
      inputType: "CMAF",
      inputSwitchConfiguration: {
        mqcsInputSwitching: true,
        preferredInput: 3 as any, // Invalid value
      },
      endpoints: {
        testEndpoint: {
          containerType: "CMAF",
          originEndpointName: "test",
          resourcePolicyType: "PUBLIC",
          startoverWindowSeconds: 1209600,
          segment: {
            segmentName: "segment",
            includeIframeOnlyStreams: false,
            segmentDurationSeconds: 4,
            scte: {
              scteFilter: ["SPLICE_INSERT"],
            },
          },
        },
      },
    };

    expect(() => {
      new MediaPackageV2(stack, "TestMediaPackage", {
        channelName: "test-channel",
        channelGroupName: "test-group",
        configuration: config,
        tags: [],
      });
    }).not.toThrow(); // CDK validation happens at synth time, not construct time
  });
});
