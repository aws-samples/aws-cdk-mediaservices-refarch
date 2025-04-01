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

import { App, Aws, Stack } from "aws-cdk-lib";
import type { AggregatedResult } from "@jest/test-result";
import { Template } from "aws-cdk-lib/assertions";
import { LefEventStack } from "../../lib/event/lef_event_stack";
import { IEventConfig } from "../../lib/event/eventConfigInterface";
import {
  GENERATED_CONFIG_PATH,
  GENERATED_TEMPLATE_PATH,
} from "../test.constants";
import * as fs from "fs";
import * as yaml from "yaml";
import * as path from "path";

/**
 * Ensures a test directory exists and is empty
 * @param directoryPath Path to the test directory
 */
export function prepareTestDirectory(directoryPath: string): void {
  try {
    fs.rmSync(directoryPath, { recursive: true });
  } catch (e) {
    // ignore if directory doesn't exist
  } finally {
    fs.mkdirSync(directoryPath, { recursive: true });
  }
}

export function cleanupTestDirectory(
  directoryPath: string,
  testResults?: { numFailedTests: number } | undefined,
): void {
  if (!testResults || testResults.numFailedTests === 0) {
    try {
      fs.rmSync(directoryPath, { recursive: true });
    } catch (e) {
      console.warn(
        `Warning: Could not clean up test directory ${directoryPath}: ${e}`,
      );
    }
  } else {
    console.log(
      `Test failures detected. Preserving test data in ${directoryPath} for investigation.`,
    );
  }
}

/**
 * Common template assertions for MediaLive resources
 */
export const mediaLiveAssertions = {
  /**
   * Assert MediaLive channel class
   * @param template CloudFormation template
   * @param channelClass Expected channel class
   */
  assertChannelClass: (template: Template, channelClass: string): void => {
    template.hasResourceProperties("AWS::MediaLive::Channel", {
      ChannelClass: channelClass,
    });
  },

  /**
   * Assert MediaLive input type and settings
   * @param template CloudFormation template
   * @param inputType Expected input type
   * @param settings Expected input settings
   */
  assertInput: (template: Template, inputType: string, settings: any): void => {
    template.hasResourceProperties("AWS::MediaLive::Input", {
      Type: inputType,
      ...settings,
    });
  },

  /**
   * Assert resource counts
   * @param template CloudFormation template
   * @param expectedCounts Expected resource counts
   */
  assertResourceCounts: (
    template: Template,
    expectedCounts: Record<string, number>,
  ): void => {
    Object.entries(expectedCounts).forEach(([resourceType, count]) => {
      template.resourceCountIs(resourceType, count);
    });
  },
};

/**
 * Creates an event stack for testing purposes
 * @param app The CDK App instance
 * @param configFile Path to the configuration file
 * @returns Stack instance
 */
export function createEventStack(app: App, testDesciptor: string): Stack {
  const configFilename = getConfigFilename(testDesciptor);
  const templateFilename = getTemplateFilename(testDesciptor);

  const lefStack = new LefEventStack(
    app,
    "LefEventStack",
    {
      env: {
        region: `${Aws.REGION}`,
        account: `${Aws.ACCOUNT_ID}`,
      },
    },
    configFilename,
  );

  writeTemplateToFile(templateFilename, lefStack);

  return lefStack;
}

/**
 * Writes a configuration object to a TypeScript file
 * @param configObject Configuration object to write
 * @param outputFileName Output file path
 */
export function writeConfigToFile(
  configObject: any,
  outputFileName: string,
): void {
  try {
    let configFileString =
      "import { IEventConfig } from '../../../lib/event/eventConfigInterface';";
    configFileString += "\n\n";
    configFileString += "export const EVENT_CONFIG: IEventConfig = ";

    let configBody = JSON.stringify(configObject, null, 2);
    let configBodyUnquotedKey = configBody.replace(/"([^"]+)":/g, "$1:");
    configFileString += configBodyUnquotedKey;

    configFileString += ";\n\n";

    // Check and create directory for outputFileName if it doesn't exist
    try {
      ensureDirectoryExists(outputFileName);
    } catch (error) {
      console.error("Error in directory creation:", error);
    }

    fs.writeFileSync(outputFileName, configFileString);
  } catch (error) {
    console.error("Failed to write configuration:", error);
    throw error;
  }
}

/**
 * Writes a CloudFormation template to a file
 * @param outputFileName Output file path
 * @param lefStack Stack to generate template from
 */
export function writeTemplateToFile(
  outputFileName: string,
  lefStack: Stack,
): void {
  try {
    const template = Template.fromStack(lefStack);
    const jsonTemplate = template.toJSON();
    const yamlTemplate = yaml.stringify(jsonTemplate);

    if (!yamlTemplate) {
      throw new Error("Template generation resulted in empty content");
    }

    // Check and create directory for outputFileName if it doesn't exist
    try {
      ensureDirectoryExists(outputFileName);
    } catch (error) {
      console.error("Error in directory creation:", error);
    }

    fs.writeFileSync(outputFileName, yamlTemplate);
  } catch (error) {
    console.error("Failed to write template:", error);
    throw error;
  }
}

/**
 * Creates an event configuration by merging base config with additional config
 * @param baseConfig Base configuration
 * @param additionalConfig Additional configuration to merge
 * @param outputConfigFilename Output file path
 * @returns Path to the generated configuration file
 */
export function createEventConfiguration(
  baseConfig: IEventConfig,
  additionalConfig: any,
  outputConfigFilename: string,
): string {
  // Make a deep copy of configuration
  let config = JSON.parse(JSON.stringify(baseConfig));

  // // Set Test Parameters
  // if (additionalConfig.event?.mediaLive) {
  //   // Set Channel Class
  //   if (additionalConfig.event.mediaLive.channelClass) {
  //     config.event.mediaLive.channelClass = additionalConfig.event.mediaLive.channelClass;
  //   }

  //   // Set input
  //   if (additionalConfig.event.mediaLive.input) {
  //     config.event.mediaLive.input = additionalConfig.event.mediaLive.input;
  //   }
  // }

  writeConfigToFile(config, outputConfigFilename);
  return outputConfigFilename;
}

/**
 * Creates a directory if it doesn't exist
 * @param outputFileName - The full path including the filename
 * @returns void
 * @throws Error if directory creation fails
 */
function ensureDirectoryExists(outputFileName: string): void {
  try {
    // Get the directory path from the full file path
    const directoryPath = path.dirname(outputFileName);

    // Check if directory exists
    if (!fs.existsSync(directoryPath)) {
      fs.mkdirSync(directoryPath, {
        recursive: true,
        mode: 0o755, // Explicitly set directory permissions
      });
    }
  } catch (error) {
    // Type guard to ensure error is an Error object
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";

    console.error(`Failed to create directory: ${errorMessage}`);
    throw new Error(`Failed to ensure directory exists: ${errorMessage}`);
  }
}

export function getConfigFilename(testDescriptor: string) {
  // Create full path to config file
  const projectRoot = process.cwd();
  return `${projectRoot}/${GENERATED_CONFIG_PATH}/${testDescriptor}.ts`;
}

export function getTemplateFilename(testDescriptor: string) {
  // Create full path to config file
  const projectRoot = process.cwd();
  return `${projectRoot}/${GENERATED_TEMPLATE_PATH}/${testDescriptor}.json`;
}
