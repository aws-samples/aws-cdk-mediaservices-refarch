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

import { IEventConfig } from "../event/eventConfigInterface";
import { IEventGroupConfig } from "../event_group/eventGroupConfigInterface";
import { IFoundationConfig } from "../foundation/foundationConfigInterface";

export type ConfigType = IEventConfig | IEventGroupConfig | IFoundationConfig;

export interface IConfigValidator<T extends ConfigType> {
  validateConfig(config: T): void;
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export function loadConfig<T>(configFilePath: string, configKey: string): T {
  try {
    const config = require(configFilePath);
    const loadedConfig = config[configKey];

    if (!loadedConfig) {
      throw new ConfigurationError(
        `Configuration key "${configKey}" not found in ${configFilePath}`,
      );
    }

    return loadedConfig;
  } catch (err) {
    if (err instanceof ConfigurationError) {
      throw err;
    }
    if (err instanceof Error) {
      throw new ConfigurationError(
        `Failed to load configuration file (${configFilePath}): ${err.message}`,
      );
    }
    throw new ConfigurationError(
      `Failed to load configuration file (${configFilePath}): ${String(err)}`,
    );
  }
}
