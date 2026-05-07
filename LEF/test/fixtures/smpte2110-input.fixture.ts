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

import { ISmpte2110Input } from "../../lib/event/inputs/mediaLiveInputTypes";

export const singlePipelineSmpte2110Input: ISmpte2110Input = {
  inputName: "test-smpte2110-single-pipeline-input",
  type: "SMPTE_2110",
  smpte2110ReceiverGroupSettings: {
    receiverGroupId: "rg-001",
    receivers: [
      {
        receiverId: "video-001",
        multicastIp: "239.1.1.10",
        port: 5000,
        streamType: "VIDEO",
      },
      {
        receiverId: "audio-001",
        multicastIp: "239.1.1.11",
        port: 5001,
        streamType: "AUDIO",
      },
    ],
  },
};

export const standardChannelSmpte2110Input: ISmpte2110Input = {
  inputName: "test-smpte2110-standard-input",
  type: "SMPTE_2110",
  smpte2110ReceiverGroupSettings: {
    receiverGroupId: "rg-002",
    receivers: [
      {
        receiverId: "video-primary",
        multicastIp: "239.1.1.20",
        port: 5000,
        interfaceId: "eth0",
        streamType: "VIDEO",
      },
      {
        receiverId: "video-secondary",
        multicastIp: "239.1.1.21",
        port: 5000,
        interfaceId: "eth1",
        streamType: "VIDEO",
      },
      {
        receiverId: "audio-primary",
        multicastIp: "239.1.1.22",
        port: 5001,
        interfaceId: "eth0",
        streamType: "AUDIO",
      },
      {
        receiverId: "audio-secondary",
        multicastIp: "239.1.1.23",
        port: 5001,
        interfaceId: "eth1",
        streamType: "AUDIO",
      },
    ],
  },
};
