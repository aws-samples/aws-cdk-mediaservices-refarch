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

import { ISrtCallerInput } from "../../lib/event/inputs/mediaLiveInputTypes";

export const singlePipelineSrtCallerInput: ISrtCallerInput = {
  inputName: "test-srt-caller-input",
  type: "SRT_CALLER",
  srtListenerAddress: "192.168.1.100",
  srtListenerPort: 9000,
  streamId: "test-stream",
  minimumLatency: 120,
};

export const standardChannelSrtCallerInput: ISrtCallerInput = {
  inputName: "test-srt-caller-input-standard",
  type: "SRT_CALLER",
  srtListenerAddress: "10.0.0.50",
  srtListenerPort: 9001,
  streamId: "live-event-1",
  minimumLatency: 200,
};

export const srtCallerInputWithEncryption: ISrtCallerInput = {
  inputName: "test-srt-caller-encrypted",
  type: "SRT_CALLER",
  srtListenerAddress: "192.168.1.200",
  srtListenerPort: 9000,
  streamId: "encrypted-stream",
  minimumLatency: 120,
  decryption: {
    algorithm: "AES256",
    passphrase:
      "arn:aws:secretsmanager:us-east-1:123456789012:secret:srt-passphrase",
  },
};
