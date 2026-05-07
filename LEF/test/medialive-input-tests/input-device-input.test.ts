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
import { Template, Match } from "aws-cdk-lib/assertions";
import { createEventStack } from "../utils/test-utils";
import { EVENT_CONFIG } from "../../config/default/eventConfiguration";
import {
  singlePipelineInputDeviceInput,
  standardChannelInputDeviceInput,
} from "../fixtures/input-device-input.fixture";
import { TestConfigBuilder } from "../utils/test-config-builder";
import { ANYWHERE_SETTINGS } from "../test.constants";

const ConfigService = {
  defaultConfig: EVENT_CONFIG,
};

describe("LEF Event Stack", () => {
  describe("MediaLive Input Configurations - Input Device Inputs", () => {
    let app: App;
    let template: Template;
    let testDescriptor1 = "Event";

    beforeEach(() => {
      app = new App();
    });

    describe("Single Pipeline MediaLive Channel", () => {
      const encoderType = "MediaLive";
      const channelClass = "SINGLE_PIPELINE";
      const testDescriptor2 = `${testDescriptor1}_${encoderType}_${channelClass}_InputDeviceInput`;
      let testConfig;

      beforeEach(() => {
        // Create default configuration and modify with test parameters
        testConfig = new TestConfigBuilder(ConfigService.defaultConfig)
          .withChannelClass(channelClass)
          .withInputs([singlePipelineInputDeviceInput])
          .withAnywhereSettings(ANYWHERE_SETTINGS)
          .writeConfig(testDescriptor2);

        // Build stack
        const lefStack = createEventStack(app, testDescriptor2);
        template = Template.fromStack(lefStack);
      });

      it("should create media live input and media live channel resources", () => {
        template.resourceCountIs("AWS::MediaLive::Input", 1);
        template.resourceCountIs("AWS::MediaLive::Channel", 1);
      });

      it("should create a single pipeline channel", () => {
        template.hasResourceProperties("AWS::MediaLive::Channel", {
          ChannelClass: "SINGLE_PIPELINE",
        });
      });

      it("should create an input device input with correct settings", () => {
        template.hasResourceProperties("AWS::MediaLive::Input", {
          Name: Match.anyValue(),
          Type: "INPUT_DEVICE",
          InputDevices: [
            {
              Id: singlePipelineInputDeviceInput.deviceId,
            },
          ],
        });
      });
    });

    describe("Standard MediaLive Channel should fail", () => {
      const encoderType = "MediaLive";
      const channelClass = "STANDARD";
      const testDescriptor2 = `${testDescriptor1}_${encoderType}_${channelClass}_InputDeviceInput`;

      it("should throw error when trying to use standard channel with MediaLive Anywhere", () => {
        expect(() => {
          // Create default configuration and modify with test parameters
          const testConfig = new TestConfigBuilder(ConfigService.defaultConfig)
            .withChannelClass(channelClass)
            .withInputs([standardChannelInputDeviceInput])
            .withAnywhereSettings(ANYWHERE_SETTINGS)
            .writeConfig(testDescriptor2);

          // Build stack
          const lefStack = createEventStack(app, testDescriptor2);
        }).toThrow(
          "Invalid MediaLive Configuration. MediaLive Anywhere does not support STANDARD channels.",
        );
      });
    });
  });
});
