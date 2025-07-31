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
import * as path from 'path';

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

    // Check if the loaded config has mediaLive configuration
    if (loadedConfig.event?.mediaLive?.encodingProfileLocation) {
      const encodingProfilePath = loadedConfig.event.mediaLive.encodingProfileLocation;
      
      // CDK commands to deploy/synth need to be executed from the project root directory
      // The actual cdk command run is in 'node_modules/.bin'.
      // Many of the resources referenced in this project are relative to the
      // 'node_modules/.bin' directory.

      // Check if the path is relative
      if (!path.isAbsolute(encodingProfilePath)) {
        // Convert relative path to absolute path
        loadedConfig.event.mediaLive.encodingProfileLocation = path.resolve(
          process.cwd(),
          'node_modules/.bin',
          encodingProfilePath
        );
      }
    }

    return loadedConfig;
  } catch (err: unknown) {
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
