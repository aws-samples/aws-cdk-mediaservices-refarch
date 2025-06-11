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

import { IFileInput } from "../../lib/event/inputs/mediaLiveInputTypes";

export const singlePipelineFileInput: IFileInput = {
  inputName: "test-file-input",
  type: "MP4_FILE",
  urls: ["s3://bucket/example-file.mp4"],
};

export const standardChannelFileInput: IFileInput = {
  inputName: "test-file-input-standard",
  type: "TS_FILE",
  urls: ["s3://bucket/example-file-1.ts", "s3://bucket/example-file-2.ts"],
};
