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
import { IntegTest } from "@aws-cdk/integ-tests-alpha";
import { TestConfigBuilder } from "../utils/test-config-builder";
import { EVENT_CONFIG } from "../../config/default/eventConfiguration";
import {
  singlePipelineInputDeviceInput,
  standardChannelInputDeviceInput,
} from "../fixtures/input-device-input.fixture";
import { createEventStack } from "../utils/test-utils";
import { EVENT_GROUP_STACK_NAME, ANYWHERE_SETTINGS } from "../test.constants";

const ConfigService = {
  defaultConfig: EVENT_CONFIG,
};

describe("Input Device Input Integration Tests", () => {
  let app: App;

  beforeEach(() => {
    app = new App();
  });

  test("SinglePipeline MediaLive Input Device Input", () => {
    const testDescriptor = "InputDevice_SinglePipeline_MediaLive";

    const testConfig = new TestConfigBuilder(ConfigService.defaultConfig)
      .withChannelClass("SINGLE_PIPELINE")
      .withInput(singlePipelineInputDeviceInput)
      .writeConfig(testDescriptor);

    const lefStack = createEventStack(app, testDescriptor);

    new IntegTest(app, "Test_InputDevice_SinglePipeline_MediaLive", {
      testCases: [lefStack],
      cdkCommandOptions: {
        deploy: {
          args: {
            parameters: {
              eventGroupStackName: EVENT_GROUP_STACK_NAME,
            },
          },
        },
      },
    });
  });

  test("Standard MediaLive Input Device Input", () => {
    const testDescriptor = "InputDevice_Standard_MediaLive";

    const testConfig = new TestConfigBuilder(ConfigService.defaultConfig)
      .withChannelClass("STANDARD")
      .withInput(standardChannelInputDeviceInput)
      .writeConfig(testDescriptor);

    const lefStack = createEventStack(app, testDescriptor);

    new IntegTest(app, "Test_InputDevice_Standard_MediaLive", {
      testCases: [lefStack],
      cdkCommandOptions: {
        deploy: {
          args: {
            parameters: {
              eventGroupStackName: EVENT_GROUP_STACK_NAME,
            },
          },
        },
      },
    });
  });

  test("SinglePipeline MediaLiveAnywhere Input Device Input", () => {
    const testDescriptor = "InputDevice_SinglePipeline_MediaLiveAnywhere";

    const testConfig = new TestConfigBuilder(ConfigService.defaultConfig)
      .withChannelClass("SINGLE_PIPELINE")
      .withInput(singlePipelineInputDeviceInput)
      .withAnywhereSettings(ANYWHERE_SETTINGS)
      .writeConfig(testDescriptor);

    const lefStack = createEventStack(app, testDescriptor);

    new IntegTest(app, "Test_InputDevice_SinglePipeline_MediaLiveAnywhere", {
      testCases: [lefStack],
      cdkCommandOptions: {
        deploy: {
          args: {
            parameters: {
              eventGroupStackName: EVENT_GROUP_STACK_NAME,
            },
          },
        },
      },
    });
  });

  test("Standard MediaLiveAnywhere Input Device Input should fail", () => {
    const testDescriptor = "InputDevice_Standard_MediaLiveAnywhere";

    expect(() => {
      const testConfig = new TestConfigBuilder(ConfigService.defaultConfig)
        .withChannelClass("STANDARD")
        .withInput(standardChannelInputDeviceInput)
        .withAnywhereSettings(ANYWHERE_SETTINGS)
        .writeConfig(testDescriptor);

      const lefStack = createEventStack(app, testDescriptor);

      new IntegTest(app, "Test_InputDevice_Standard_MediaLiveAnywhere", {
        testCases: [lefStack],
        cdkCommandOptions: {
          deploy: {
            args: {
              parameters: {
                eventGroupStackName: EVENT_GROUP_STACK_NAME,
              },
            },
          },
        },
      });
    }).toThrow(
      "Invalid MediaLive Configuration. MediaLive Anywhere does not support STANDARD channels.",
    );
  });
});
