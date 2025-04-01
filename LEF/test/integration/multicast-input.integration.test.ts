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
  singlePipelineMulticastInput,
  standardChannelMulticastInput,
} from "../fixtures/multicast-input.fixture";
import { createEventStack } from "../utils/test-utils";
import { EVENT_GROUP_STACK_NAME, ANYWHERE_SETTINGS } from "../test.constants";

const ConfigService = {
  defaultConfig: EVENT_CONFIG,
};

describe("Multicast Input Integration Tests", () => {
  let app: App;

  beforeEach(() => {
    app = new App();
  });

  test("SinglePipeline MediaLive Multicast Input", () => {
    const testDescriptor = "Multicast_SinglePipeline_MediaLive";

    expect(() => {
      const testConfig = new TestConfigBuilder(ConfigService.defaultConfig)
        .withChannelClass("SINGLE_PIPELINE")
        .withInput(singlePipelineMulticastInput)
        .writeConfig(testDescriptor);

      const lefStack = createEventStack(app, testDescriptor);

      new IntegTest(app, "Test_Multicast_SinglePipeline_MediaLive", {
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
      "Invalid MediaLive Configuration. 'MULTICAST' inputs are only available on MediaLive Anywhere.",
    );
  });

  test("Standard MediaLive Multicast Input", () => {
    const testDescriptor = "Multicast_Standard_MediaLive";

    expect(() => {
      const testConfig = new TestConfigBuilder(ConfigService.defaultConfig)
        .withChannelClass("STANDARD")
        .withInput(standardChannelMulticastInput)
        .writeConfig(testDescriptor);

      const lefStack = createEventStack(app, testDescriptor);

      new IntegTest(app, "Test_Multicast_Standard_MediaLive", {
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
      "Invalid MediaLive Configuration. 'MULTICAST' inputs are only available on MediaLive Anywhere.",
    );
  });

  test("SinglePipeline MediaLiveAnywhere Multicast Input", () => {
    const testDescriptor = "Multicast_SinglePipeline_MediaLiveAnywhere";

    const testConfig = new TestConfigBuilder(ConfigService.defaultConfig)
      .withChannelClass("SINGLE_PIPELINE")
      .withInput(singlePipelineMulticastInput)
      .withAnywhereSettings(ANYWHERE_SETTINGS)
      .writeConfig(testDescriptor);

    const lefStack = createEventStack(app, testDescriptor);

    new IntegTest(app, "Test_Multicast_SinglePipeline_MediaLiveAnywhere", {
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

  test("Standard MediaLiveAnywhere Multicast Input should fail", () => {
    const testDescriptor = "Multicast_Standard_MediaLiveAnywhere";

    expect(() => {
      const testConfig = new TestConfigBuilder(ConfigService.defaultConfig)
        .withChannelClass("STANDARD")
        .withInput(standardChannelMulticastInput)
        .withAnywhereSettings(ANYWHERE_SETTINGS)
        .writeConfig(testDescriptor);

      const lefStack = createEventStack(app, testDescriptor);

      new IntegTest(app, "Test_Multicast_Standard_MediaLiveAnywhere", {
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
