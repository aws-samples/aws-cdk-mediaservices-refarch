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

import { IMulticastInput } from "../../lib/event/inputs/mediaLiveInputTypes";

export const singlePipelineMulticastInput: IMulticastInput = {
  inputName: "test-multicast-single-pipeline-input",
  type: "MULTICAST",
  multicastSettings: {
    sources: [
      {
        url: "udp://10.0.0.4:5000",
        sourceIp: "239.0.0.3",
      },
    ],
  },
};

export const standardChannelMulticastInput: IMulticastInput = {
  inputName: "test-multicast-standard-input",
  type: "MULTICAST",
  multicastSettings: {
    sources: [
      {
        url: "udp://10.0.0.1:5000",
        sourceIp: "239.0.0.1",
      },
      {
        url: "udp://10.0.0.2:5000",
        sourceIp: "239.0.0.2",
      },
    ],
  },
};
