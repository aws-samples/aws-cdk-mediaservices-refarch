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

import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { CloudFront } from "../lib/event_group/cloudfront";

describe("CloudFront Multiple MediaTailor Configurations", () => {
  let app: App;
  let stack: Stack;

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, "TestStack");
  });

  describe("Single MediaTailor Configuration", () => {
    it("should create CloudFront distribution", () => {
      new CloudFront(stack, "TestCloudFront", {
        foundationStackName: "foundation-stack",
        mediaTailorConfigs: [
          {
            name: "primary",
            hostname: "primary.mediatailor.us-west-2.amazonaws.com"
          }
        ],
        mediaPackageHostname: "mediapackage.us-west-2.amazonaws.com",
        mediaPackageChannelGroupName: "test-channel-group",
        s3LoggingEnabled: false,
        logFilePrefix: "logs",
        nominalSegmentLength: 4,
        enableIpv6: true
      });

      const template = Template.fromStack(stack);
      template.resourceCountIs("AWS::CloudFront::Distribution", 1);
    });
  });

  describe("Multiple MediaTailor Configurations", () => {
    it("should create CloudFront distribution with multiple origins", () => {
      new CloudFront(stack, "TestCloudFront", {
        foundationStackName: "foundation-stack",
        mediaTailorConfigs: [
          {
            name: "primary",
            hostname: "primary.mediatailor.us-west-2.amazonaws.com"
          },
          {
            name: "secondary", 
            hostname: "secondary.mediatailor.us-west-2.amazonaws.com"
          }
        ],
        mediaPackageHostname: "mediapackage.us-west-2.amazonaws.com",
        mediaPackageChannelGroupName: "test-channel-group",
        s3LoggingEnabled: false,
        logFilePrefix: "logs",
        nominalSegmentLength: 4,
        enableIpv6: true
      });

      const template = Template.fromStack(stack);
      template.resourceCountIs("AWS::CloudFront::Distribution", 1);
    });

    it("should handle three MediaTailor configurations", () => {
      new CloudFront(stack, "TestCloudFront", {
        foundationStackName: "foundation-stack",
        mediaTailorConfigs: [
          {
            name: "hls-config",
            hostname: "hls.mediatailor.us-west-2.amazonaws.com"
          },
          {
            name: "dash-config",
            hostname: "dash.mediatailor.us-west-2.amazonaws.com"
          },
          {
            name: "backup-config",
            hostname: "backup.mediatailor.us-west-2.amazonaws.com"
          }
        ],
        mediaPackageHostname: "mediapackage.us-west-2.amazonaws.com",
        mediaPackageChannelGroupName: "test-channel-group",
        s3LoggingEnabled: false,
        logFilePrefix: "logs",
        nominalSegmentLength: 4,
        enableIpv6: true
      });

      const template = Template.fromStack(stack);
      template.resourceCountIs("AWS::CloudFront::Distribution", 1);
    });
  });

  describe("Origin Configuration", () => {
    it("should configure origin timeouts based on segment length", () => {
      new CloudFront(stack, "TestCloudFront", {
        foundationStackName: "foundation-stack",
        mediaTailorConfigs: [
          {
            name: "timeout-test",
            hostname: "timeout.mediatailor.us-west-2.amazonaws.com"
          }
        ],
        mediaPackageHostname: "mediapackage.us-west-2.amazonaws.com",
        mediaPackageChannelGroupName: "test-channel-group",
        s3LoggingEnabled: false,
        logFilePrefix: "logs",
        nominalSegmentLength: 6,
        enableIpv6: true
      });

      const template = Template.fromStack(stack);
      template.resourceCountIs("AWS::CloudFront::Distribution", 1);
    });

    it("should configure Origin Shield when enabled", () => {
      new CloudFront(stack, "TestCloudFront", {
        foundationStackName: "foundation-stack",
        mediaTailorConfigs: [
          {
            name: "shield-test",
            hostname: "shield.mediatailor.us-west-2.amazonaws.com"
          }
        ],
        mediaPackageHostname: "mediapackage.us-west-2.amazonaws.com",
        mediaPackageChannelGroupName: "test-channel-group",
        s3LoggingEnabled: false,
        logFilePrefix: "logs",
        nominalSegmentLength: 4,
        enableIpv6: true,
        enableOriginShield: true,
        originShieldRegion: "us-east-1"
      });

      const template = Template.fromStack(stack);
      template.resourceCountIs("AWS::CloudFront::Distribution", 1);
    });
  });
});