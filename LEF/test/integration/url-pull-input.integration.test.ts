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
  singlePipelineUrlPullInput,
  standardChannelUrlPullInput,
} from "../fixtures/url-pull-input.fixture";
import { createEventStack } from "../utils/test-utils";
import { EVENT_GROUP_STACK_NAME, ANYWHERE_SETTINGS } from "../test.constants";

const ConfigService = {
  defaultConfig: EVENT_CONFIG,
};

describe("URL Pull Input Integration Tests", () => {
  let app: App;

  beforeEach(() => {
    app = new App();
  });

  test("SinglePipeline MediaLive URL Pull Input", () => {
    const testDescriptor = "UrlPull_SinglePipeline_MediaLive";

    const testConfig = new TestConfigBuilder(ConfigService.defaultConfig)
      .withChannelClass("SINGLE_PIPELINE")
      .withInputs([singlePipelineUrlPullInput])
      .writeConfig(testDescriptor);

    const lefStack = createEventStack(app, testDescriptor);

    new IntegTest(app, "Test_UrlPull_SinglePipeline_MediaLive", {
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

  test("Standard MediaLive URL Pull Input", () => {
    const testDescriptor = "UrlPull_Standard_MediaLive";

    const testConfig = new TestConfigBuilder(ConfigService.defaultConfig)
      .withChannelClass("STANDARD")
      .withInputs([standardChannelUrlPullInput])
      .writeConfig(testDescriptor);

    const lefStack = createEventStack(app, testDescriptor);

    new IntegTest(app, "Test_UrlPull_Standard_MediaLive", {
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

  test("SinglePipeline MediaLiveAnywhere URL Pull Input", () => {
    const testDescriptor = "UrlPull_SinglePipeline_MediaLiveAnywhere";

    const testConfig = new TestConfigBuilder(ConfigService.defaultConfig)
      .withChannelClass("SINGLE_PIPELINE")
      .withInputs([singlePipelineUrlPullInput])
      .withAnywhereSettings(ANYWHERE_SETTINGS)
      .writeConfig(testDescriptor);

    const lefStack = createEventStack(app, testDescriptor);

    new IntegTest(app, "Test_UrlPull_SinglePipeline_MediaLiveAnywhere", {
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

  test("Standard MediaLiveAnywhere URL Pull Input should fail", () => {
    const testDescriptor = "UrlPull_Standard_MediaLiveAnywhere";

    expect(() => {
      const testConfig = new TestConfigBuilder(ConfigService.defaultConfig)
        .withChannelClass("STANDARD")
        .withInputs([standardChannelUrlPullInput])
        .withAnywhereSettings(ANYWHERE_SETTINGS)
        .writeConfig(testDescriptor);

      const lefStack = createEventStack(app, testDescriptor);

      new IntegTest(app, "Test_UrlPull_Standard_MediaLiveAnywhere", {
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
