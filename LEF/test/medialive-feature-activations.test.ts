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

import { aws_medialive as medialive } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { MediaLive, MediaLiveOutputGroupType } from "../lib/event/medialive";
import { App, Stack } from "aws-cdk-lib";

describe("MediaLive Feature Activations", () => {
  test("Feature activations are correctly set when enabled", () => {
    // Create a new app and stack
    const app = new App();
    const stack = new Stack(app, "TestStack");

    // Create a MediaLive instance with feature activations enabled
    new MediaLive(stack, "TestMediaLive", {
      channelName: "TestChannel",
      mediaLiveAccessRoleArn: "arn:aws:iam::123456789012:role/MediaLiveAccessRole",
      destinationConfig: {
        type: MediaLiveOutputGroupType.HLS,
        channelClass: "STANDARD",
        endpoints: {
          primary: "https://example.com/endpoint1",
          secondary: "https://example.com/endpoint2"
        }
      },
      tags: [],
      configuration: {
        encodingProfileLocation: "./test/fixtures/mock-encoder-settings/mock-profile.json",
        channelClass: "STANDARD",
        segmentLengthInSeconds: 4,
        inputSpecification: {
          codec: "AVC",
          maximumBitrate: "MAX_20_MBPS",
          resolution: "HD",
        },
        enableInputPrepareScheduleActions: true,
        enableStaticImageOverlayScheduleActions: true,
        inputs: [
          {
            type: "MP4_FILE",
            urls: ["s3://example/file.mp4", "s3://example/file.mp4"],
          },
        ],
      },
    });

    // Get the CloudFormation template
    const template = Template.fromStack(stack);

    // Check that the feature activations are correctly set
    template.hasResourceProperties("AWS::MediaLive::Channel", {
      EncoderSettings: {
        FeatureActivations: {
          InputPrepareScheduleActions: "ENABLED",
          OutputStaticImageOverlayScheduleActions: "ENABLED",
        },
      },
    });
  });

  test("Feature activations are not set when disabled", () => {
    // Create a new app and stack
    const app = new App();
    const stack = new Stack(app, "TestStack2");

    // Create a MediaLive instance without feature activations
    new MediaLive(stack, "TestMediaLive", {
      channelName: "TestChannel",
      mediaLiveAccessRoleArn: "arn:aws:iam::123456789012:role/MediaLiveAccessRole",
      destinationConfig: {
        type: MediaLiveOutputGroupType.HLS,
        channelClass: "STANDARD",
        endpoints: {
          primary: "https://example.com/endpoint1",
          secondary: "https://example.com/endpoint2"
        }
      },
      tags: [],
      configuration: {
        encodingProfileLocation: "./test/fixtures/mock-encoder-settings/mock-profile.json",
        channelClass: "STANDARD",
        segmentLengthInSeconds: 4,
        inputSpecification: {
          codec: "AVC",
          maximumBitrate: "MAX_20_MBPS",
          resolution: "HD",
        },
        // No feature activations enabled
        inputs: [
          {
            type: "MP4_FILE",
            urls: ["s3://example/file.mp4", "s3://example/file.mp4"],
          },
        ],
      },
    });

    // Get the CloudFormation template
    const template = Template.fromStack(stack);

    // Check that the feature activations are not set
    const resources = template.findResources("AWS::MediaLive::Channel");
    const channelResource = Object.values(resources)[0];
    
    // Verify FeatureActivations is not present
    expect(channelResource.Properties.FeatureActivations).toBeUndefined();
  });
});