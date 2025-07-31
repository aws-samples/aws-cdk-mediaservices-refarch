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
import { MediaLive, MediaLiveOutputGroupType } from "../../lib/event/medialive";
import { MediaLiveChannelClass } from "../../lib/event/eventConfigInterface";
import { Construct } from "constructs";

// Mock the Construct class
jest.mock("constructs");

// Mock the MediaLive CfnInput and CfnChannel classes
jest.mock("aws-cdk-lib", () => {
  const originalModule = jest.requireActual("aws-cdk-lib");
  return {
    ...originalModule,
    aws_medialive: {
      CfnInput: jest.fn().mockImplementation(() => ({
        ref: "test-input-ref",
        name: "test-input-name",
        attrDestinations: ["test-destination-1", "test-destination-2"],
      })),
      CfnChannel: jest.fn().mockImplementation(() => ({
        attrArn: "test-channel-arn",
      })),
      CfnInputSecurityGroup: jest.fn().mockImplementation(() => ({
        ref: "test-security-group-ref",
      })),
    },
    Aws: {
      STACK_NAME: "test-stack",
    },
    CfnOutput: jest.fn(),
    Fn: {
      join: jest.fn().mockReturnValue("joined-string"),
      select: jest.fn().mockReturnValue("selected-string"),
    },
  };
});

describe("MediaLive HLS Input bufferSegments Configuration", () => {
  let mediaLive: MediaLive;
  let mockScope: Construct;

  beforeEach(() => {
    jest.clearAllMocks();
    // @ts-ignore - Mocking Construct with string as second parameter
    mockScope = new Construct("test-id", "test-scope");
  });

  test("should set bufferSegments to 2 for HLS inputs when multiple inputs are configured", () => {
    // Arrange
    const props = {
      channelName: "test-channel",
      mediaLiveAccessRoleArn: "test-role-arn",
      configuration: {
        encodingProfileLocation: "./test/fixtures/mock-encoder-settings/mock-profile.json",
        channelClass: "STANDARD" as MediaLiveChannelClass,
        segmentLengthInSeconds: 4,
        inputSpecification: {
          codec: "AVC",
          maximumBitrate: "MAX_10_MBPS",
          resolution: "HD",
        },
        inputs: [
          {
            inputName: "primary-input",
            type: "URL_PULL",
            urls: [
              {
                url: "https://example1.com/primary.m3u8",
                username: "user1",
                password: "param1",
              },
            ],
          },
          {
            inputName: "backup-input",
            type: "URL_PULL",
            urls: [
              {
                url: "https://example2.com/backup.m3u8",
                username: "user2",
                password: "param2",
              },
            ],
          },
        ],
      },
      destinationConfig: {
        type: MediaLiveOutputGroupType.HLS,
        channelClass: "STANDARD" as MediaLiveChannelClass,
        endpoints: {
          primary: "test-endpoint-1",
          secondary: "test-endpoint-2"
        }
      },
      tags: [],
    };

    // Act
    // @ts-ignore - Type issues with test props
    mediaLive = new MediaLive(mockScope, "test-id", props);

    // Assert
    expect(medialive.CfnInput).toHaveBeenCalledTimes(2);
    expect(medialive.CfnChannel).toHaveBeenCalledTimes(1);
    
    // Get the call arguments for CfnChannel
    // @ts-ignore - Mock type conversion
    const channelArgs = (medialive.CfnChannel as jest.Mock).mock.calls[0][2];
    
    // Verify that both input attachments have bufferSegments set to 10 in hlsInputSettings
    expect(channelArgs.inputAttachments[0].inputSettings.networkInputSettings.hlsInputSettings.bufferSegments).toBe(3);
    expect(channelArgs.inputAttachments[1].inputSettings.networkInputSettings.hlsInputSettings.bufferSegments).toBe(3);
  });

  test("should not set bufferSegments for HLS inputs when only one input is configured", () => {
    // Arrange
    const props = {
      channelName: "test-channel",
      mediaLiveAccessRoleArn: "test-role-arn",
      configuration: {
        encodingProfileLocation: "./test/fixtures/mock-encoder-settings/mock-profile.json",
        channelClass: "STANDARD" as MediaLiveChannelClass,
        segmentLengthInSeconds: 4,
        inputSpecification: {
          codec: "AVC",
          maximumBitrate: "MAX_10_MBPS",
          resolution: "HD",
        },
        inputs: [
          {
            inputName: "single-input",
            type: "URL_PULL",
            urls: [
              {
                url: "https://example.com/stream.m3u8",
                username: "user",
                password: "pass",
              },
            ],
          },
        ],
      },
      destinationConfig: {
        type: MediaLiveOutputGroupType.HLS,
        channelClass: "STANDARD" as MediaLiveChannelClass,
        endpoints: {
          primary: "test-endpoint-1",
          secondary: "test-endpoint-2"
        }
      },
      tags: [],
    };

    // Act
    // @ts-ignore - Type issues with test props
    mediaLive = new MediaLive(mockScope, "test-id", props);

    // Assert
    expect(medialive.CfnInput).toHaveBeenCalledTimes(1);
    expect(medialive.CfnChannel).toHaveBeenCalledTimes(1);
    
    // Get the call arguments for CfnChannel
    // @ts-ignore - Mock type conversion
    const channelArgs = (medialive.CfnChannel as jest.Mock).mock.calls[0][2];
    
    // Verify that the input attachment does not have bufferSegments set
    expect(channelArgs.inputAttachments[0].inputSettings.networkInputSettings.hlsInputSettings.bufferSegments).toBeUndefined();
  });

  test("should not affect non-HLS inputs when multiple inputs are configured", () => {
    // Arrange
    const props = {
      channelName: "test-channel",
      mediaLiveAccessRoleArn: "test-role-arn",
      configuration: {
        encodingProfileLocation: "./test/fixtures/mock-encoder-settings/mock-profile.json",
        channelClass: "STANDARD" as MediaLiveChannelClass,
        segmentLengthInSeconds: 4,
        inputSpecification: {
          codec: "AVC",
          maximumBitrate: "MAX_10_MBPS",
          resolution: "HD",
        },
        inputs: [
          {
            inputName: "hls-input",
            type: "URL_PULL",
            urls: [
              {
                url: "https://example.com/stream.m3u8",
                username: "user1",
                password: "pass1",
              },
            ],
          },
          {
            inputName: "mp4-input",
            type: "MP4_FILE",
            urls: ["s3://test-bucket/test-file.mp4"],
          },
        ],
      },
      destinationConfig: {
        type: MediaLiveOutputGroupType.HLS,
        channelClass: "STANDARD" as MediaLiveChannelClass,
        endpoints: {
          primary: "test-endpoint-1",
          secondary: "test-endpoint-2"
        }
      },
      tags: [],
    };

    // Act
    // @ts-ignore - Type issues with test props
    mediaLive = new MediaLive(mockScope, "test-id", props);

    // Assert
    expect(medialive.CfnInput).toHaveBeenCalledTimes(2);
    expect(medialive.CfnChannel).toHaveBeenCalledTimes(1);
    
    // Get the call arguments for CfnChannel
    // @ts-ignore - Mock type conversion
    const channelArgs = (medialive.CfnChannel as jest.Mock).mock.calls[0][2];
    
    // Verify that the HLS input has bufferSegments set to 3
    expect(channelArgs.inputAttachments[0].inputSettings.networkInputSettings.hlsInputSettings.bufferSegments).toBe(3);
    
    // Verify that the MP4 input doesn't have networkInputSettings.hlsInputSettings
    expect(channelArgs.inputAttachments[1].inputSettings.networkInputSettings).toBeUndefined();
  });
});