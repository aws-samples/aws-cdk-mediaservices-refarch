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

import { IRtmpPushInput } from "../../lib/event/inputs/mediaLiveInputTypes";

export const singlePipelineRtmpPushInput: IRtmpPushInput = {
  inputName: "test-rtmp-push-input",
  type: "RTMP_PUSH",
  cidr: ["10.0.0.0/24"],
};

export const standardChannelRtmpPushInput: IRtmpPushInput = {
  inputName: "test-rtmp-push-input-standard",
  type: "RTMP_PUSH",
  cidr: ["10.0.0.0/24", "10.0.1.0/24"],
};
