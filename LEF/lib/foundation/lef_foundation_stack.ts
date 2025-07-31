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
import { Aws, aws_iam as iam, CfnParameter, Tags } from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { LefBaseStack } from "../lef_base_stack";
import { Foundation } from "./foundation";
import { IFoundationConfig } from "./foundationConfigInterface";

// Define a regular expression pattern for email validation
const emailRegex =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

export class LefFoundationStack extends LefBaseStack {
  constructor(
    scope: Construct,
    id: string,
    props: cdk.StackProps,
    configFilePath: string,
  ) {
    super(scope, id, props);

    // Import foundation configuration
    const config = this.loadConfig(configFilePath);

    // Validate foundation configuration
    this.validateConfig(config);

    // Create standard tags for foundation stack
    this.resourceTags = this.createStandardTags(scope, "LefFoundationStack", Aws.STACK_NAME);

    // Define parameter to capture email address to subscribe to SNS topic
    const userEmail = new CfnParameter(this, "userEmail", {
      type: "String",
      description: "Email address to subscribe to SNS topic",
      allowedPattern: emailRegex.source, // Use the regular expression pattern for email validation
    }).valueAsString;

    // Deploy foundational resources for CloudFront
    // Enabling S3 logging to default to create an S3 Bucket for logging.
    // CloudFront logs can be enabled/disabled in the configuration for each Event Group
    const cloudfront = new Foundation(this, "CloudFrontFoundation", {
      userEmail: userEmail,
      config: config.cloudFront,
      tags: this.resourceTags,
    });
  }

  loadConfig(configFilePath: string): IFoundationConfig {
    return this.getConfig<IFoundationConfig>(
      configFilePath,
      "FOUNDATION_CONFIG",
    );
  }

  // validate foundation configuration
  validateConfig(config: IFoundationConfig): void {
    // Additional stack-specific validations can be added here

    if (
      !config.cloudFront.logging ||
      typeof config.cloudFront.logging.logRetentionPeriod !== "number"
    ) {
      throw new Error(
        "Invalid or missing log retention period in CloudFront configuration",
      );
    }
  }
}
