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
import { createEventStack } from "../../utils/test-utils";
import { EVENT_CONFIG } from "../../../config/default/eventConfiguration";
import { singlePipelineSrtCallerInput } from "../../fixtures/srt-caller-input.fixture";
import { TestConfigBuilder } from "../../utils/test-config-builder";

const ConfigService = {
  defaultConfig: EVENT_CONFIG,
};

describe("LEF Event Stack - SRT Caller Input Integration", () => {
  let app: App;
  let template: Template;
  const testDescriptor = "Event_MediaLive_SrtCallerInput_Integration";

  beforeEach(() => {
    app = new App();

    const testConfig = new TestConfigBuilder(ConfigService.defaultConfig)
      .withChannelClass("SINGLE_PIPELINE")
      .withInputs([singlePipelineSrtCallerInput])
      .writeConfig(testDescriptor);

    const lefStack = createEventStack(app, testDescriptor);
    template = Template.fromStack(lefStack);
  });

  it("should create all required resources for SRT Caller input", () => {
    template.resourceCountIs("AWS::MediaLive::Input", 1);
    template.resourceCountIs("AWS::MediaLive::Channel", 1);
  });

  it("should configure MediaLive channel with SRT Caller input attachment", () => {
    template.hasResourceProperties("AWS::MediaLive::Channel", {
      InputAttachments: Match.arrayWith([
        Match.objectLike({
          InputAttachmentName: Match.anyValue(),
          InputId: Match.objectLike({
            Ref: Match.anyValue(),
          }),
          InputSettings: {
            SourceEndBehavior: "CONTINUE",
          },
        }),
      ]),
    });
  });

  it("should create SRT Caller input with role ARN", () => {
    template.hasResourceProperties("AWS::MediaLive::Input", {
      Type: "SRT_CALLER",
      RoleArn: Match.anyValue(),
    });
  });
});
