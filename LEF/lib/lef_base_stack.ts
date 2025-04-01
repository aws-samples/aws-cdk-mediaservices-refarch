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

import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { loadConfig } from "./config/configValidator";
import { TagManager, Tags, aws_iam as iam } from "aws-cdk-lib";

/**
 * Base stack class for LEF stacks with common functionality
 */
export abstract class LefBaseStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
  }

  /**
   * Validates the provided configuration object.
   * Each derived stack must implement its own validation logic.
   * @param config The configuration object to validate
   */
  protected abstract validateConfig(config: any): void;

  /**
   * Loads and returns a typed configuration object from the specified file.
   * @param configFilePath Path to the configuration file
   * @param configKey Key in the configuration file that contains the desired config
   * @returns The loaded configuration object
   * @throws ConfigurationError if the config cannot be loaded or is invalid
   */
  protected getConfig<T>(configFilePath: string, configKey: string): T {
    return loadConfig<T>(configFilePath, configKey);
  }

  // Function to selectively tag resources in the stack
  tagResources(tags: Record<string, string>[]) {
    // Group all taggable resources
    const taggableResources = this.node
      .findAll()
      .filter(
        (child) =>
          TagManager.isTaggable(child) &&
          !(child instanceof iam.Role) &&
          !(child instanceof cdk.Stack),
      );

    // Apply all tags to each taggable resource
    for (const resource of taggableResources) {
      for (const tag of tags) {
        for (const [key, value] of Object.entries(tag)) {
          Tags.of(resource).add(key, value);
        }
      }
    }
  }
}
