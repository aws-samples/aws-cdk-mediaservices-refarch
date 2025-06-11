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

import { IEventConfig } from "../../lib/event/eventConfigInterface";
import { writeConfigToFile, getConfigFilename } from "./test-utils";

export class TestConfigBuilder {
  private config: any;

  constructor(baseConfig: IEventConfig) {
    this.config = JSON.parse(JSON.stringify(baseConfig));
  }
  withChannelClass(channelClass: string): TestConfigBuilder {
    this.config.event.mediaLive.channelClass = channelClass;
    return this;
  }

  withInput(input: any): TestConfigBuilder {
    this.config.event.mediaLive.input = input;
    return this;
  }

  withAnywhereSettings(settings: any): TestConfigBuilder {
    this.config.event.mediaLive.anywhereSettings = settings;
    return this;
  }

  writeConfig(testDesciptor: string): any {
    const filename = getConfigFilename(testDesciptor);
    writeConfigToFile(this.config, filename);
    return this.config;
  }
}
