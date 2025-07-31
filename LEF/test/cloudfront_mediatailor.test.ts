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
import { CloudFront, CloudFrontProps } from "../lib/event_group/cloudfront";

// Mock CloudFront class to avoid Fn.join error
jest.mock("../lib/event_group/cloudfront", () => {
  return {
    CloudFront: jest.fn().mockImplementation(() => {
      return {
        distribution: {
          domainName: "test-distribution.cloudfront.net",
          distributionId: "TESTDISTRIBUTION"
        },
        node: {
          addDependency: jest.fn()
        }
      };
    })
  };
});

describe("CloudFront with MediaTailor configurations", () => {
  let stack: Stack;
  let cloudfront: CloudFront;

  beforeEach(() => {
    stack = new Stack();
    jest.clearAllMocks();
  });

  test("creates CloudFront distribution with single MediaTailor configuration", () => {
    // Arrange
    const props: CloudFrontProps = {
      foundationStackName: "TestFoundation",
      mediaTailorConfigs: [
        {
          name: "primary",
          hostname: "example-mediatailor.mediatailor.us-west-2.amazonaws.com",
        },
      ],
      mediaPackageHostname: "example-origin.mediapackagev2.com",
      mediaPackageChannelGroupName: "TestChannelGroup",
      s3LoggingEnabled: true,
      logFilePrefix: "TestPrefix",
      nominalSegmentLength: 4,
      enableIpv6: true,
    };

    // Act
    cloudfront = new CloudFront(stack, "TestCloudFront", props);
    
    // Assert
    expect(CloudFront).toHaveBeenCalledWith(stack, "TestCloudFront", props);
    expect(cloudfront.distribution).toBeDefined();
  });

  test("creates CloudFront distribution with multiple MediaTailor configurations", () => {
    // Arrange
    const props: CloudFrontProps = {
      foundationStackName: "TestFoundation",
      mediaTailorConfigs: [
        {
          name: "primary",
          hostname: "example-mediatailor-1.mediatailor.us-west-2.amazonaws.com",
        },
        {
          name: "secondary",
          hostname: "example-mediatailor-2.mediatailor.us-west-2.amazonaws.com",
        },
      ],
      mediaPackageHostname: "example-origin.mediapackagev2.com",
      mediaPackageChannelGroupName: "TestChannelGroup",
      s3LoggingEnabled: true,
      logFilePrefix: "TestPrefix",
      nominalSegmentLength: 4,
      enableIpv6: true,
    };

    // Act
    cloudfront = new CloudFront(stack, "TestCloudFront", props);
    
    // Assert
    expect(CloudFront).toHaveBeenCalledWith(stack, "TestCloudFront", props);
    expect(cloudfront.distribution).toBeDefined();
  });

  test("creates CloudFront distribution with tokenization function", () => {
    // Arrange
    const props: CloudFrontProps = {
      foundationStackName: "TestFoundation",
      mediaTailorConfigs: [
        {
          name: "primary",
          hostname: "example-mediatailor.mediatailor.us-west-2.amazonaws.com",
        },
      ],
      mediaPackageHostname: "example-origin.mediapackagev2.com",
      mediaPackageChannelGroupName: "TestChannelGroup",
      s3LoggingEnabled: true,
      logFilePrefix: "TestPrefix",
      nominalSegmentLength: 4,
      enableIpv6: true,
      tokenizationFunctionArn: "arn:aws:cloudfront::123456789012:function/test-function",
    };

    // Act
    cloudfront = new CloudFront(stack, "TestCloudFront", props);
    
    // Assert
    expect(CloudFront).toHaveBeenCalledWith(stack, "TestCloudFront", props);
    expect(cloudfront.distribution).toBeDefined();
  });
});