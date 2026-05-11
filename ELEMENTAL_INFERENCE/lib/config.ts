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

import { IInferenceConfig } from "./configInterface";

export const STACK_PREFIX_NAME = "EI-RefArch";

export const INFERENCE_CONFIG: IInferenceConfig = {
  mediaConnect: {
    protocol: "srt-listener",
    whitelistCidr: "0.0.0.0/0",
    // vpcConfig: { subnetId: "subnet-xxx", securityGroupIds: ["sg-xxx"] },
  },
  inference: {
    enableSmartCrop: true,
    enableClipping: true,
  },
  videoConfig: {
    horizontal: [
      { name: "h_1080p30", width: 1920, height: 1080, maxBitrate: 5000000, qvbrQualityLevel: 8 },
      { name: "h_720p30",  width: 1280, height: 720,  maxBitrate: 3000000, qvbrQualityLevel: 7 },
      { name: "h_360p30",  width: 640,  height: 360,  maxBitrate: 1000000, qvbrQualityLevel: 6 },
    ],
    vertical: [
      { name: "v_1080p30", width: 1080, height: 1920, maxBitrate: 5000000, qvbrQualityLevel: 8 },
      { name: "v_720p30",  width: 720,  height: 1280, maxBitrate: 3000000, qvbrQualityLevel: 7 },
      { name: "v_360p30",  width: 360,  height: 640,  maxBitrate: 1000000, qvbrQualityLevel: 6 },
    ],
  },
  channelGroupName: "ei-refarch",
  callbackMetadata: "SRC-01",
};
