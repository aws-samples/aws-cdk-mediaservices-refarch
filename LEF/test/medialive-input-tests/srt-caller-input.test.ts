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
  singlePipelineSrtCallerInput,
  standardChannelSrtCallerInput,
  srtCallerInputWithEncryption,
} from "../fixtures/srt-caller-input.fixture";
import { TestConfigBuilder } from "../utils/test-config-builder";

const ConfigService = {
  defaultConfig: EVENT_CONFIG,
};

describe("LEF Event Stack", () => {
  describe("MediaLive Input Configurations - SRT Caller Inputs", () => {
    let app: App;
    let template: Template;
    let testDescriptor1 = "Event";

    beforeEach(() => {
      app = new App();
    });

    describe("Single Pipeline MediaLive Channel", () => {
      const encoderType = "MediaLive";
      const channelClass = "SINGLE_PIPELINE";
      const testDescriptor2 = `${testDescriptor1}_${encoderType}_${channelClass}_SrtCallerInput`;
      let testConfig;

      beforeEach(() => {
        testConfig = new TestConfigBuilder(ConfigService.defaultConfig)
          .withChannelClass(channelClass)
          .withInputs([singlePipelineSrtCallerInput])
          .writeConfig(testDescriptor2);

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

      it("should create a srt caller input with correct settings", () => {
        template.hasResourceProperties("AWS::MediaLive::Input", {
          Name: Match.anyValue(),
          Type: "SRT_CALLER",
          Sources: Match.arrayWith([
            Match.objectLike({
              SrtCallerSource: {
                SrtListenerAddress: "192.168.1.100",
                SrtListenerPort: 9000,
                StreamId: "test-stream",
                MinimumLatency: 120,
              },
            }),
          ]),
        });
      });
    });

    describe("Standard MediaLive Channel", () => {
      const encoderType = "MediaLive";
      const channelClass = "STANDARD";
      const testDescriptor2 = `${testDescriptor1}_${encoderType}_${channelClass}_SrtCallerInput`;
      let testConfig;

      beforeEach(() => {
        testConfig = new TestConfigBuilder(ConfigService.defaultConfig)
          .withChannelClass(channelClass)
          .withInputs([standardChannelSrtCallerInput])
          .writeConfig(testDescriptor2);

        const lefStack = createEventStack(app, testDescriptor2);
        template = Template.fromStack(lefStack);
      });

      it("should create media live input and media live channel resources", () => {
        template.resourceCountIs("AWS::MediaLive::Input", 1);
        template.resourceCountIs("AWS::MediaLive::Channel", 1);
      });

      it("should create a standard channel", () => {
        template.hasResourceProperties("AWS::MediaLive::Channel", {
          ChannelClass: "STANDARD",
        });
      });

      it("should create a srt caller input with correct settings", () => {
        template.hasResourceProperties("AWS::MediaLive::Input", {
          Name: Match.anyValue(),
          Type: "SRT_CALLER",
          Sources: Match.arrayWith([
            Match.objectLike({
              SrtCallerSource: {
                SrtListenerAddress: "10.0.0.50",
                SrtListenerPort: 9001,
                StreamId: "live-event-1",
                MinimumLatency: 200,
              },
            }),
          ]),
        });
      });
    });

    describe("SRT Caller Input with Encryption", () => {
      const encoderType = "MediaLive";
      const channelClass = "SINGLE_PIPELINE";
      const testDescriptor2 = `${testDescriptor1}_${encoderType}_${channelClass}_SrtCallerInputEncrypted`;
      let testConfig;

      beforeEach(() => {
        testConfig = new TestConfigBuilder(ConfigService.defaultConfig)
          .withChannelClass(channelClass)
          .withInputs([srtCallerInputWithEncryption])
          .writeConfig(testDescriptor2);

        const lefStack = createEventStack(app, testDescriptor2);
        template = Template.fromStack(lefStack);
      });

      it("should create a srt caller input with encryption settings", () => {
        template.hasResourceProperties("AWS::MediaLive::Input", {
          Name: Match.anyValue(),
          Type: "SRT_CALLER",
          Sources: Match.arrayWith([
            Match.objectLike({
              SrtCallerSource: {
                SrtListenerAddress: "192.168.1.200",
                SrtListenerPort: 9000,
                StreamId: "encrypted-stream",
                MinimumLatency: 120,
                Decryption: {
                  Algorithm: "AES256",
                  PassphraseSecretArn:
                    "arn:aws:secretsmanager:us-east-1:123456789012:secret:srt-passphrase", // pragma: allowlist secret
                },
              },
            }),
          ]),
        });
      });
    });
  });
});
