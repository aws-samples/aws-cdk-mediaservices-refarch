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

import { Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { MediaTailor, MediaTailorProps } from "../lib/event_group/mediatailor";
import { Construct } from "constructs";

describe("MediaTailor", () => {
  let stack: Stack;
  let template: Template;

  beforeEach(() => {
    stack = new Stack();
  });

  test("creates a MediaTailor playback configuration with basic settings", () => {
    // Arrange
    const props: MediaTailorProps = {
      configurationName: "TestConfig",
      configuration: {
        name: "primary",
        adDecisionServerUrl: "https://example.com/ads",
        contentSegmentUrlPrefix: "/",
        adSegmentUrlPrefix: "/",
        slateAdUrl: "https://example.com/slate.mov",
      },
      originHostname: "example-origin.mediapackagev2.com",
    };

    // Act
    new MediaTailor(stack, "TestMediaTailor", props);
    template = Template.fromStack(stack);

    // Assert
    template.resourceCountIs("AWS::MediaTailor::PlaybackConfiguration", 1);
    template.hasResourceProperties("AWS::MediaTailor::PlaybackConfiguration", {
      Name: "TestConfig",
      AdDecisionServerUrl: "https://example.com/ads",
      VideoContentSourceUrl: "https://example-origin.mediapackagev2.com",
    });
  });

  test("creates a MediaTailor playback configuration with name suffix", () => {
    // Arrange
    const props: MediaTailorProps = {
      configurationName: "TestConfig",
      configurationNameSuffix: "primary",
      configuration: {
        name: "primary",
        adDecisionServerUrl: "https://example.com/ads",
        contentSegmentUrlPrefix: "/",
        adSegmentUrlPrefix: "/",
        slateAdUrl: "https://example.com/slate.mov",
      },
      originHostname: "example-origin.mediapackagev2.com",
    };

    // Act
    new MediaTailor(stack, "TestMediaTailor", props);
    template = Template.fromStack(stack);

    // Assert
    template.hasResourceProperties("AWS::MediaTailor::PlaybackConfiguration", {
      Name: "TestConfig-primary",
    });
  });

  test("creates a MediaTailor playback configuration with content segment prefix alias", () => {
    // Arrange
    const props: MediaTailorProps = {
      configurationName: "TestConfig",
      configuration: {
        name: "primary",
        adDecisionServerUrl: "https://example.com/ads",
        contentSegmentUrlPrefix: "[player_params.content_segment_prefix]",
        adSegmentUrlPrefix: "/",
        slateAdUrl: "https://example.com/slate.mov",
      },
      originHostname: "example-origin.mediapackagev2.com",
    };

    // Act
    new MediaTailor(stack, "TestMediaTailor", props);
    template = Template.fromStack(stack);

    // Assert
    template.hasResourceProperties("AWS::MediaTailor::PlaybackConfiguration", {
      ConfigurationAliases: {
        "player_params.content_segment_prefix": {
          "hls-cmaf": "../../../../..",
          "dash-cmaf": "../../../../../../../../..",
        }
      }
    });
  });

  test("creates a MediaTailor playback configuration with ad segment prefix alias", () => {
    // Arrange
    const props: MediaTailorProps = {
      configurationName: "TestConfig",
      configuration: {
        name: "primary",
        adDecisionServerUrl: "https://example.com/ads",
        contentSegmentUrlPrefix: "/",
        adSegmentUrlPrefix: "[player_params.ad_segment_prefix]",
        slateAdUrl: "https://example.com/slate.mov",
      },
      originHostname: "example-origin.mediapackagev2.com",
    };

    // Act
    new MediaTailor(stack, "TestMediaTailor", props);
    template = Template.fromStack(stack);

    // Assert
    template.hasResourceProperties("AWS::MediaTailor::PlaybackConfiguration", {
      ConfigurationAliases: {
        "player_params.ad_segment_prefix": {
          "hls-cmaf": "../../../../../..",
          "dash-cmaf": "../../../../../../../../..",
        }
      }
    });
  });

  test("creates a MediaTailor playback configuration with transcode profiles", () => {
    // Arrange
    const props: MediaTailorProps = {
      configurationName: "TestConfig",
      configuration: {
        name: "primary",
        adDecisionServerUrl: "https://example.com/ads",
        contentSegmentUrlPrefix: "/",
        adSegmentUrlPrefix: "/",
        slateAdUrl: "https://example.com/slate.mov",
        transcodeProfiles: {
          hlsCmaf: "hls-profile",
          dashCmaf: "dash-profile"
        }
      },
      originHostname: "example-origin.mediapackagev2.com",
    };

    // Act
    new MediaTailor(stack, "TestMediaTailor", props);
    template = Template.fromStack(stack);

    // Assert
    template.hasResourceProperties("AWS::MediaTailor::PlaybackConfiguration", {
      TranscodeProfileName: "[player_params.transcode_profile]",
      ConfigurationAliases: {
        "player_params.transcode_profile": {
          "hls-cmaf": "hls-profile",
          "dash-cmaf": "dash-profile",
        }
      }
    });
  });

  test("creates a MediaTailor playback configuration with empty transcode profiles", () => {
    // Arrange
    const props: MediaTailorProps = {
      configurationName: "TestConfig",
      configuration: {
        name: "primary",
        adDecisionServerUrl: "https://example.com/ads",
        contentSegmentUrlPrefix: "/",
        adSegmentUrlPrefix: "/",
        slateAdUrl: "https://example.com/slate.mov",
        transcodeProfiles: {
          hlsCmaf: "",
          dashCmaf: ""
        }
      },
      originHostname: "example-origin.mediapackagev2.com",
    };

    // Act
    new MediaTailor(stack, "TestMediaTailor", props);
    template = Template.fromStack(stack);

    // Assert
    template.hasResourceProperties("AWS::MediaTailor::PlaybackConfiguration", {
      TranscodeProfileName: "[player_params.transcode_profile]"
    });
  });

  test("creates a MediaTailor playback configuration with undefined name", () => {
    // Arrange
    const props: MediaTailorProps = {
      configurationName: "TestConfig",
      configurationNameSuffix: "primary",
      configuration: {
        adDecisionServerUrl: "https://example.com/ads",
        contentSegmentUrlPrefix: "/",
        adSegmentUrlPrefix: "/",
        slateAdUrl: "https://example.com/slate.mov",
      },
      originHostname: "example-origin.mediapackagev2.com",
    };

    // Act
    new MediaTailor(stack, "TestMediaTailor", props);
    template = Template.fromStack(stack);

    // Assert
    template.hasResourceProperties("AWS::MediaTailor::PlaybackConfiguration", {
      Name: "TestConfig", // Should use base name without suffix when configuration name is undefined
    });
  });

  test("creates a MediaTailor playback configuration with empty name", () => {
    // Arrange
    const props: MediaTailorProps = {
      configurationName: "TestConfig",
      configurationNameSuffix: "primary",
      configuration: {
        name: "", // Empty name
        adDecisionServerUrl: "https://example.com/ads",
        contentSegmentUrlPrefix: "/",
        adSegmentUrlPrefix: "/",
        slateAdUrl: "https://example.com/slate.mov",
      },
      originHostname: "example-origin.mediapackagev2.com",
    };

    // Act
    new MediaTailor(stack, "TestMediaTailor", props);
    template = Template.fromStack(stack);

    // Assert
    template.hasResourceProperties("AWS::MediaTailor::PlaybackConfiguration", {
      Name: "TestConfig", // Should use base name without suffix when configuration name is empty
    });
  });
});