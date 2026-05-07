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
import { createEventStack } from "../utils/test-utils";
import { EVENT_CONFIG } from "../../config/default/eventConfiguration";
import {
  singlePipelineSmpte2110Input,
  standardChannelSmpte2110Input,
} from "../fixtures/smpte2110-input.fixture";
import { TestConfigBuilder } from "../utils/test-config-builder";

describe("MediaLive SMPTE 2110 Input Tests", () => {
  let app: App;
  let template: Template;

  beforeEach(() => {
    app = new App();
  });

  const anywhereSettings = {
    channelPlacementGroupId: "test-placement-group",
    clusterId: "test-cluster",
  };

  test("Single Pipeline SMPTE 2110 Input", () => {
    const testDescriptor = "SMPTE2110_SinglePipeline";

    new TestConfigBuilder(EVENT_CONFIG)
      .withChannelClass("SINGLE_PIPELINE")
      .withInputs([singlePipelineSmpte2110Input])
      .withAnywhereSettings(anywhereSettings)
      .writeConfig(testDescriptor);

    const lefStack = createEventStack(app, testDescriptor);
    template = Template.fromStack(lefStack);

    // Verify SMPTE 2110 input is created
    template.hasResourceProperties("AWS::MediaLive::Input", {
      Type: "SMPTE_2110",
      Name: "test-smpte2110-single-pipeline-input",
      Smpte2110Settings: {
        ReceiversGroupId: "rg-001",
        Receivers: [
          {
            ReceiverId: "video-001",
            MulticastIp: "239.1.1.10",
            Port: 5000,
            StreamType: "VIDEO",
          },
          {
            ReceiverId: "audio-001",
            MulticastIp: "239.1.1.11",
            Port: 5001,
            StreamType: "AUDIO",
          },
        ],
      },
    });

    // Verify channel has correct input attachment
    template.hasResourceProperties("AWS::MediaLive::Channel", {
      ChannelClass: "SINGLE_PIPELINE",
      InputAttachments: [
        {
          InputAttachmentName: "test-smpte2110-single-pipeline-input",
          InputSettings: {
            SourceEndBehavior: "CONTINUE",
          },
        },
      ],
    });
  });

  test("Standard Channel SMPTE 2110 should fail validation", () => {
    const testDescriptor = "SMPTE2110_Standard";

    new TestConfigBuilder(EVENT_CONFIG)
      .withChannelClass("STANDARD")
      .withInputs([standardChannelSmpte2110Input])
      .withAnywhereSettings(anywhereSettings)
      .writeConfig(testDescriptor);

    // MediaLive Anywhere does not support STANDARD channels
    expect(() => {
      createEventStack(app, testDescriptor);
    }).toThrow("MediaLive Anywhere does not support STANDARD channels");
  });

  test("SMPTE 2110 Input without MediaLive Anywhere should fail validation", () => {
    const testDescriptor = "SMPTE2110_NoAnywhere";

    new TestConfigBuilder(EVENT_CONFIG)
      .withChannelClass("SINGLE_PIPELINE")
      .withInputs([singlePipelineSmpte2110Input])
      // Note: Not setting anywhereSettings to test validation
      .writeConfig(testDescriptor);

    // SMPTE 2110 inputs require MediaLive Anywhere
    expect(() => {
      createEventStack(app, testDescriptor);
    }).toThrow("SMPTE_2110' inputs are only available on MediaLive Anywhere");
  });
});
