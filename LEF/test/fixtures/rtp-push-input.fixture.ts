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

import { IRtpPushInput } from "../../lib/event/inputs/mediaLiveInputTypes";

export const singlePipelineRtpPushInput: IRtpPushInput = {
  inputName: "test-rtp-push-input",
  type: "RTP_PUSH",
  cidr: ["10.0.0.0/24"],
};

export const standardRtpPushInput: IRtpPushInput = {
  inputName: "test-rtp-push-input-standard",
  type: "RTP_PUSH",
  cidr: ["57.1.2.0/24", "95.0.1.0/28"],
};

export const mediaLiveAnywhereInput: IRtpPushInput = {
  inputName: "test-rtp-push-input-anywhere",
  type: "RTP_PUSH",
  cidr: ["9.14.11.12/32"],
};
