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
  singlePipelineRtpPushInput,
  standardRtpPushInput,
  mediaLiveAnywhereInput,
} from "../fixtures/rtp-push-input.fixture";
import { TestConfigBuilder } from "../utils/test-config-builder";

const ConfigService = {
  defaultConfig: EVENT_CONFIG,
};

describe("LEF Event Stack", () => {
  describe("MediaLive Input Configurations - RTP Push Inputs", () => {
    let app: App;
    let template: Template;
    let testDescriptor1 = "Event";

    beforeEach(() => {
      app = new App();
    });

    describe("SinglePipeline MediaLive Channel", () => {
      const encoderType = "MediaLive";
      const channelClass = "SINGLE_PIPELINE";
      const testDescriptor2 = `${testDescriptor1}_${encoderType}_${channelClass}_RtpPushInput`;
      let testConfig;

      beforeEach(() => {
        testConfig = new TestConfigBuilder(ConfigService.defaultConfig)
          .withChannelClass(channelClass)
          .withInput(singlePipelineRtpPushInput)
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

      it("should create a rtp push input with correct settings", () => {
        template.hasResourceProperties("AWS::MediaLive::Input", {
          Name: Match.anyValue(),
          Type: "RTP_PUSH",
          InputSecurityGroups: Match.arrayWith([
            Match.objectLike({
              Ref: Match.anyValue(),
            }),
          ]),
        });
      });

      it("should set the CIDR range on Security Group with all the ranges in the configuration", () => {
        template.hasResourceProperties("AWS::MediaLive::InputSecurityGroup", {
          WhitelistRules: singlePipelineRtpPushInput.cidr.map((cidr) => ({
            Cidr: cidr,
          })),
        });
      });
    });

    describe("Standard MediaLive Channel", () => {
      const encoderType = "MediaLive";
      const channelClass = "STANDARD";
      const testDescriptor2 = `${testDescriptor1}_${encoderType}_${channelClass}_RtpPushInput`;
      let testConfig;

      beforeEach(() => {
        testConfig = new TestConfigBuilder(ConfigService.defaultConfig)
          .withChannelClass(channelClass)
          .withInput(standardRtpPushInput)
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

      it("should set the CIDR range on Security Group with all the ranges in the configuration", () => {
        template.hasResourceProperties("AWS::MediaLive::InputSecurityGroup", {
          WhitelistRules: standardRtpPushInput.cidr.map((cidr) => ({
            Cidr: cidr,
          })),
        });
      });

      it("should create a rtp push input with correct settings", () => {
        template.hasResourceProperties("AWS::MediaLive::Input", {
          Name: Match.anyValue(),
          Type: "RTP_PUSH",
          InputSecurityGroups: Match.arrayWith([
            Match.objectLike({
              Ref: Match.anyValue(),
            }),
          ]),
        });
      });
    });
  });
});
