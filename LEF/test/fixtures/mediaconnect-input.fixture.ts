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

import { IMediaConnectInput } from "../../lib/event/inputs/mediaLiveInputTypes";

export const singlePipelineMediaConnectInput: IMediaConnectInput = {
  inputName: "test-mediaconnect-input",
  type: "MEDIACONNECT",
  roleArn: "arn:aws:iam::123456789012:role/MediaLiveAccessRole",
  arnList: ["arn:aws:mediaconnect:us-west-2:123456789012:flow:1-23456789-abcd"],
};

export const standardChannelMediaConnectInput: IMediaConnectInput = {
  inputName: "test-mediaconnect-input-standard",
  type: "MEDIACONNECT",
  roleArn: "arn:aws:iam::123456789012:role/MediaLiveAccessRole",
  arnList: [
    "arn:aws:mediaconnect:us-west-2:123456789012:flow:1-23456789-abcd",
    "arn:aws:mediaconnect:us-west-2:123456789012:flow:1-23456789-efgh",
  ],
};
