#!/usr/bin/env node

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

import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { LefFoundationStack } from "../lib/foundation/lef_foundation_stack";
import { LefEventGroupStack } from "../lib/event_group/lef_event_group_stack";
import { LefEventStack } from "../lib/event/lef_event_stack";
import { LefEventGroupWafStack } from "../lib/event_group/lef_event_group_waf_stack";
import { Aspects } from "aws-cdk-lib";
import { AwsSolutionsChecks } from "cdk-nag";
import { loadConfig } from "../lib/config/configValidator";
import { IEventGroupConfig } from "../lib/event_group/eventGroupConfigInterface";

const app = new cdk.App();

// Get stack names from context
let foundationStackName = app.node.tryGetContext("foundationStackName");
let eventGroupStackName = app.node.tryGetContext("eventGroupStackName");
let eventStackName = app.node.tryGetContext("eventStackName");

// Get user email from context
const userEmail = app.node.tryGetContext("userEmail");

// If no stack names are provided at all, use defaults
// This allows cdk destroy --all, cdk list, etc. to work
if (!foundationStackName && !eventGroupStackName && !eventStackName) {
  foundationStackName = "LefFoundation";
  eventGroupStackName = "LefEventGroup";
  eventStackName = "LefEvent";
  console.log("No stack names provided: using default stack names");
}

// Get optional configuration
const contextDescription = app.node.tryGetContext("stackDescription");

// Try to get config files with stack-specific prefix first, then fall back to unprefixed
const foundationConfigFile =
  app.node.tryGetContext(`${foundationStackName}:foundationConfigFile`) ??
  app.node.tryGetContext("foundationConfigFile");
const eventGroupConfigFile =
  app.node.tryGetContext(`${eventGroupStackName}:eventGroupConfigFile`) ??
  app.node.tryGetContext("eventGroupConfigFile");
const eventConfigFile =
  app.node.tryGetContext(`${eventStackName}:eventConfigFile`) ??
  app.node.tryGetContext("eventConfigFile");

const DEFAULT_FOUNDATION_CONFIG =
  "../../config/default/foundationConfiguration.ts";
const DEFAULT_EVENT_GROUP_CONFIG =
  "../../config/default/eventGroupConfiguration.ts";
const DEFAULT_EVENT_CONFIG = "../../config/default/eventConfiguration.ts";

// Default environment for all stacks
const defaultEnv = {
  region: process.env.CDK_DEFAULT_REGION,
  account: process.env.CDK_DEFAULT_ACCOUNT,
};

// WAF must be deployed in us-east-1 for CloudFront
const wafEnv = {
  region: "us-east-1",
  account: process.env.CDK_DEFAULT_ACCOUNT,
};

Aspects.of(app).add(new AwsSolutionsChecks());

/**
 * Generate stack description with optional suffix
 */
function getStackDescription(
  contextDescription: string | undefined,
  suffix: string,
): string {
  return contextDescription
    ? `${contextDescription} - ${suffix}`
    : `Live Event Framework ${suffix} Stack`;
}

/**
 * Determine deployment mode based on provided context parameters
 */
type DeploymentMode =
  | "ALL"
  | "FOUNDATION"
  | "EVENT_GROUP"
  | "EVENT"
  | "INVALID";

function getDeploymentMode(
  foundationStackName: string | undefined,
  eventGroupStackName: string | undefined,
  eventStackName: string | undefined,
  userEmail: string | undefined,
): DeploymentMode {
  // Allow ALL mode with or without userEmail (userEmail only required for actual deployment)
  if (foundationStackName && eventGroupStackName && eventStackName) {
    return "ALL";
  }
  if (eventStackName && eventGroupStackName) {
    return "EVENT";
  }
  if (eventGroupStackName && foundationStackName) {
    return "EVENT_GROUP";
  }
  if (foundationStackName) {
    return "FOUNDATION";
  }
  return "INVALID";
}

/**
 * Print email subscription warning box
 */
function printEmailWarning(userEmail: string): void {
  const emailPrefix = "  An SNS subscription email will be sent to: ";
  const availableSpace = 76 - emailPrefix.length;
  const paddedEmail =
    userEmail.length > availableSpace
      ? userEmail.substring(0, availableSpace)
      : userEmail.padEnd(availableSpace);

  console.log(
    "\x1b[33m╔════════════════════════════════════════════════════════════════════════════╗\x1b[0m",
  );
  console.log(
    "\x1b[33m║                    DEPLOY ALL MODE - IMPORTANT NOTICE                      ║\x1b[0m",
  );
  console.log(
    "\x1b[33m╠════════════════════════════════════════════════════════════════════════════╣\x1b[0m",
  );
  console.log(
    `\x1b[33m║${emailPrefix}\x1b[1m${paddedEmail}\x1b[0m\x1b[33m║\x1b[0m`,
  );
  console.log(
    "\x1b[33m║                                                                            ║\x1b[0m",
  );
  console.log(
    "\x1b[33m║  \x1b[1mPlease check your email and confirm the subscription after deployment.\x1b[0m\x1b[33m    ║\x1b[0m",
  );
  console.log(
    "\x1b[33m║  Notifications will not work until the subscription is confirmed.          ║\x1b[0m",
  );
  console.log(
    "\x1b[33m║                                                                            ║\x1b[0m",
  );
  console.log(
    "\x1b[33m║  These notifications will help monitor costs and prevent unexpected        ║\x1b[0m",
  );
  console.log(
    "\x1b[33m║  charges.                                                                  ║\x1b[0m",
  );
  console.log(
    "\x1b[33m║                                                                            ║\x1b[0m",
  );
  console.log(
    "\x1b[33m║  Check your inbox (including spam folder) for an email from AWS.           ║\x1b[0m",
  );
  console.log(
    "\x1b[33m╚════════════════════════════════════════════════════════════════════════════╝\x1b[0m",
  );
  console.log("");
}

/**
 * Create WAF stack if enabled in event group config
 */
function createWafStackIfNeeded(
  app: cdk.App,
  eventGroupStackName: string,
  eventGroupConfig: IEventGroupConfig,
  contextDescription: string | undefined,
): { wafStack?: LefEventGroupWafStack; wafWebAclArn?: string } {
  let wafStack: LefEventGroupWafStack | undefined;
  let wafWebAclArn: string | undefined;

  if (
    eventGroupConfig.cloudFront.waf?.enabled &&
    !eventGroupConfig.cloudFront.waf.webAclArn
  ) {
    wafStack = new LefEventGroupWafStack(app, "LefWafStack", {
      stackName: `${eventGroupStackName}-WAF`,
      env: wafEnv,
      description: getStackDescription(contextDescription, "WAF"),
      eventGroupName: eventGroupStackName,
      allowedIpv4Addresses:
        eventGroupConfig.cloudFront.waf.allowedIpv4Addresses,
      allowedCountryCodes: eventGroupConfig.cloudFront.waf.allowedCountryCodes,
      blockAnonymousIps: eventGroupConfig.cloudFront.waf.blockAnonymousIps,
    });
    wafWebAclArn = wafStack.webAclArn;
  } else if (
    eventGroupConfig.cloudFront.waf?.enabled &&
    eventGroupConfig.cloudFront.waf.webAclArn
  ) {
    wafWebAclArn = eventGroupConfig.cloudFront.waf.webAclArn;
  }

  return { wafStack, wafWebAclArn };
}

// Determine deployment mode
const deploymentMode = getDeploymentMode(
  foundationStackName,
  eventGroupStackName,
  eventStackName,
  userEmail,
);

switch (deploymentMode) {
  case "ALL": {
    // Deploy all three stacks together with direct references
    console.log("Deployment mode: ALL");

    // Only show warning and require email during actual deployment
    const isDeployCommand = process.argv.includes("deploy");
    if (isDeployCommand) {
      if (!userEmail) {
        throw new Error(
          "userEmail context parameter is required for deployment. Use --context userEmail=your@email.com",
        );
      }
      printEmailWarning(userEmail);
    }

    const foundation = new LefFoundationStack(
      app,
      "LefFoundationStack",
      {
        stackName: foundationStackName,
        env: defaultEnv,
        description: getStackDescription(contextDescription, "Foundation"),
      },
      foundationConfigFile ?? DEFAULT_FOUNDATION_CONFIG,
      userEmail ?? "placeholder@example.com", // Use placeholder for destroy operations
    );

    // Load event group config to check if WAF is enabled
    const eventGroupConfig = loadConfig<IEventGroupConfig>(
      eventGroupConfigFile ?? DEFAULT_EVENT_GROUP_CONFIG,
      "EVENT_GROUP_CONFIG",
    );

    // Create WAF stack if enabled
    const { wafStack, wafWebAclArn } = createWafStackIfNeeded(
      app,
      eventGroupStackName,
      eventGroupConfig,
      contextDescription,
    );

    const eventGroup = new LefEventGroupStack(
      app,
      "LefEventGroupStack",
      {
        stackName: eventGroupStackName,
        env: defaultEnv,
        description: getStackDescription(contextDescription, "Event Group"),
        crossRegionReferences: true, // Required for WAF cross-region references
      },
      eventGroupConfigFile ?? DEFAULT_EVENT_GROUP_CONFIG,
      foundation, // Direct reference
      true, // skipSubscriptionCheck = true for deploy-all mode
      wafWebAclArn, // Pass WAF Web ACL ARN if available
    );
    eventGroup.addDependency(foundation);
    if (wafStack) {
      eventGroup.addDependency(wafStack);
    }

    const event = new LefEventStack(
      app,
      "LefEventStack",
      {
        stackName: eventStackName,
        env: defaultEnv,
        description: getStackDescription(contextDescription, "Event"),
      },
      eventConfigFile ?? DEFAULT_EVENT_CONFIG,
      eventGroup, // Direct reference
    );
    event.addDependency(eventGroup);
    break;
  }

  case "EVENT": {
    // Deploy event only
    console.log("Deployment mode: EVENT - Deploying Event stack only");

    new LefEventStack(
      app,
      "LefEventStack",
      {
        stackName: eventStackName,
        env: defaultEnv,
        description: contextDescription ?? "Live Event Framework Event Stack",
      },
      eventConfigFile ?? DEFAULT_EVENT_CONFIG,
      eventGroupStackName, // String for Fn.importValue
    );
    break;
  }

  case "EVENT_GROUP": {
    // Deploy event group only
    console.log(
      "Deployment mode: EVENT GROUP - Deploying Event Group stack only",
    );

    // Load event group config to check if WAF is enabled
    const eventGroupConfig = loadConfig<IEventGroupConfig>(
      eventGroupConfigFile ?? DEFAULT_EVENT_GROUP_CONFIG,
      "EVENT_GROUP_CONFIG",
    );

    // Create WAF stack if enabled
    const { wafStack, wafWebAclArn } = createWafStackIfNeeded(
      app,
      eventGroupStackName,
      eventGroupConfig,
      contextDescription,
    );

    const eventGroupStack = new LefEventGroupStack(
      app,
      "LefEventGroupStack",
      {
        stackName: eventGroupStackName,
        env: defaultEnv,
        description:
          contextDescription ?? "Live Event Framework Event Group Stack",
        crossRegionReferences: true, // Required for WAF cross-region references
      },
      eventGroupConfigFile ?? DEFAULT_EVENT_GROUP_CONFIG,
      foundationStackName, // String for Fn.importValue
      false, // skipSubscriptionCheck = false (enforce check)
      wafWebAclArn, // Pass WAF Web ACL ARN if available
    );

    if (wafStack) {
      eventGroupStack.addDependency(wafStack);
    }
    break;
  }

  case "FOUNDATION": {
    // Deploy foundation only
    console.log("Deployment mode: FOUNDATION");

    const isDeployCommand = process.argv.includes("deploy");
    if (isDeployCommand && !userEmail) {
      throw new Error(
        "userEmail context parameter is required for deployment. Use --context userEmail=your@email.com",
      );
    }

    new LefFoundationStack(
      app,
      "LefFoundationStack",
      {
        stackName: foundationStackName,
        env: defaultEnv,
        description:
          contextDescription ?? "Live Event Framework Foundation Stack",
      },
      foundationConfigFile ?? DEFAULT_FOUNDATION_CONFIG,
      userEmail ?? "placeholder@example.com", // Use placeholder for non-deploy operations
    );
    break;
  }

  default: {
    // deploymentMode === 'INVALID'
    throw new Error(
      "Invalid context parameters. Must provide at least 'foundationStackName'. " +
        "See README.md for deployment examples.",
    );
  }
}
