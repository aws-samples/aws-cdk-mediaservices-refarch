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
import { Aws } from "aws-cdk-lib";
import { Construct } from "constructs";
import { loadConfig } from "./config/configValidator";
import { TagManager, Tags, aws_iam as iam } from "aws-cdk-lib";
import { TagArray, TaggingUtils } from "./utils/tagging";

/**
 * Base stack class for LEF stacks with common functionality
 */
export abstract class LefBaseStack extends cdk.Stack {

  /**
   * Collection of tags to be applied to resources in this stack
   * Each derived stack should populate this with appropriate tags
   */
  public resourceTags: TagArray = [];

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

  /**
   * Creates standard resource tags for a stack based on its type and relationships
   * 
   * @param scope The construct scope (used to access context values)
   * @param stackType The type of stack (e.g., "LefFoundationStack", "LefEventGroupStack", "LefEventStack")
   * @param foundationStackName The name of the foundation stack (optional, for event group and event stacks)
   * @param eventGroupStackName The name of the event group stack (optional, for event stacks)
   * @returns An array of tag objects to be used as resourceTags
   */
  protected createStandardTags(
    scope: Construct,
    stackType: string,
    foundationStackName?: string,
    eventGroupStackName?: string,
    eventStackName?: string,
  ): TagArray {
    const tags: Record<string, string> = {
      StackType: stackType,
      LiveEventFrameworkVersion: scope.node.tryGetContext("LiveEventFrameworkVersion") || "unknown"
    };

    // Add stack relationships if provided
    if (foundationStackName) {
      tags.FoundationStackName = foundationStackName;
    }
    
    if (eventGroupStackName) {
      tags.EventGroupStackName = eventGroupStackName;
    }
    
    // Always add the current stack name
    // Use the actual stack name from context if available, otherwise fall back to ID or token
    const contextStackName = scope.node.tryGetContext("stackName");
    const stackId = contextStackName || this.node.id || Aws.STACK_NAME;
    tags[`${stackType.replace('Lef', '')}Name`] = stackId;

    return [tags];
  }
  
  /**
   * Applies the resource tags to all resources in the stack
   * This method should be called after all resources have been created
   * 
   * @example
   * // In a derived stack constructor:
   * this.resourceTags = this.createStandardTags(this, "LefFoundationStack");
   * // Create resources...
   * this.tagResources();
   */
  public tagResources(): void {
    if (!this.resourceTags || this.resourceTags.length === 0) return;
    
    // Apply tags to all resources in the stack
    this.node.findAll().forEach(child => {
      if (child instanceof cdk.Resource) {
        TaggingUtils.applyTagsToResource(child, this.resourceTags);
      }
    });
  }
}
