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

import { IUrlPullInput } from "../../lib/event/inputs/mediaLiveInputTypes";

export const singlePipelineUrlPullInput: IUrlPullInput = {
  inputName: "test-url-pull-input",
  type: "URL_PULL",
  urls: [
    {
      url: "https://server1.example.com/live/stream1.m3u8",
      username: "user1",
      password: "param1",
    },
  ],
};

export const standardChannelUrlPullInput: IUrlPullInput = {
  inputName: "test-url-pull-input-standard",
  type: "URL_PULL",
  urls: [
    {
      url: "https://server1.example.com/live/stream1.m3u8",
      username: "user1",
      password: "param1",
    },
    {
      url: "https://server2.example.com/live/stream1.m3u8",
      username: "user2",
      password: "param2",
    },
  ],
};
