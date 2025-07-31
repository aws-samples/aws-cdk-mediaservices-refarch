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
  singlePipelineUrlPullInput,
  standardChannelUrlPullInput,
} from "../fixtures/url-pull-input.fixture";
import { TestConfigBuilder } from "../utils/test-config-builder";

const ConfigService = {
  defaultConfig: EVENT_CONFIG,
};

describe("LEF Event Stack", () => {
  describe("MediaLive Input Configurations - Multiple Inputs", () => {
    let app: App;
    let template: Template;
    let testDescriptor1 = "Event";

    beforeEach(() => {
      app = new App();
    });

    describe("Multiple Inputs for MediaLive Channel", () => {
      const encoderType = "MediaLive";
      const channelClass = "STANDARD";
      const testDescriptor2 = `${testDescriptor1}_${encoderType}_${channelClass}_MultipleInputs`;
      let testConfig;

      beforeEach(() => {
        // Create default configuration and modify with test parameters
        testConfig = new TestConfigBuilder(ConfigService.defaultConfig)
          .withChannelClass(channelClass)
          .withInputs([
            {
              inputName: "primary-input",
              type: "URL_PULL",
              urls: [
                {
                  url: "https://example1.com/primary.m3u8",
                  username: "user1",
                  password: "param1",
                },
                {
                  url: "https://example2.com/primary.m3u8",
                  username: "user2",
                  password: "param2",
                },
              ],
            },
            {
              inputName: "backup-input",
              type: "URL_PULL",
              urls: [
                {
                  url: "https://example1.com/backup.m3u8",
                  username: "user3",
                  password: "param3",
                },
                {
                  url: "https://example2.com/backup.m3u8",
                  username: "user4",
                  password: "param4",
                },
              ],
            },
          ])
          .writeConfig(testDescriptor2);

        // Build stack
        const lefStack = createEventStack(app, testDescriptor2);
        template = Template.fromStack(lefStack);
      });

      it("should create multiple media live inputs and one media live channel", () => {
        template.resourceCountIs("AWS::MediaLive::Input", 2);
        template.resourceCountIs("AWS::MediaLive::Channel", 1);
      });

      it("should create a standard channel", () => {
        template.hasResourceProperties("AWS::MediaLive::Channel", {
          ChannelClass: "STANDARD",
        });
      });

      it("should create the first url pull input with correct settings", () => {
        template.hasResourceProperties("AWS::MediaLive::Input", {
          Name: "primary-input",
          Type: "URL_PULL",
          Sources: [
            {
              Url: "https://example1.com/primary.m3u8",
              Username: "user1",
              PasswordParam: "param1",
            },
            {
              Url: "https://example2.com/primary.m3u8",
              Username: "user2",
              PasswordParam: "param2",
            },
          ],
        });
      });

      it("should create the second url pull input with correct settings", () => {
        template.hasResourceProperties("AWS::MediaLive::Input", {
          Name: "backup-input",
          Type: "URL_PULL",
          Sources: [
            {
              Url: "https://example1.com/backup.m3u8",
              Username: "user3",
              PasswordParam: "param3",
            },
            {
              Url: "https://example2.com/backup.m3u8",
              Username: "user4",
              PasswordParam: "param4",
            },
          ],
        });
      });

      it("should attach both inputs to the channel", () => {
        // Check that the channel has two input attachments
        const channelResources = template.findResources("AWS::MediaLive::Channel");
        const channelKeys = Object.keys(channelResources);
        const channelProperties = channelResources[channelKeys[0]].Properties;
        
        expect(channelProperties.InputAttachments).toHaveLength(2);
      });
    });
  });
});