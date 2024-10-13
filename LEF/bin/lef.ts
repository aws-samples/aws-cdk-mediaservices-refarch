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
import { Aws, Tags } from "aws-cdk-lib";
import { LefFoundationStack } from "../lib/foundation/lef_foundation_stack";
import { LefEventGroupStack } from "../lib/event_group/lef_event_group_stack";
import { LefEventStack } from "../lib/event/lef_event_stack";
import { Aspects } from "aws-cdk-lib";
import { AwsSolutionsChecks } from "cdk-nag";

const app = new cdk.App();
const stackName = app.node.tryGetContext("stackName");
const contextDescription = app.node.tryGetContext("stackDescription");
const eventConfigFile = app.node.tryGetContext("eventConfigFile");
const eventGroupConfigFile = app.node.tryGetContext("eventGroupConfigFile");
const foundationConfigFile = app.node.tryGetContext("foundationConfigFile");
const liveEventFrameworkVersion = app.node.tryGetContext("LiveEventFrameworkVersion");

const DEFAULT_EVENT_CONFIG = "../../config/eventConfiguration.ts";
const DEFAULT_EVENT_GROUP_CONFIG = "../../config/eventGroupConfiguration.ts";
const DEFAULT_FOUNDATION_CONFIG = "../../config/foundationConfiguration.ts";

Aspects.of(app).add(new AwsSolutionsChecks());

// Define Foundation Stack
const foundationStack = new LefFoundationStack(
  app,
  "LefFoundationStack",
  {
    stackName: stackName,
    env: {
      region: `${Aws.REGION}`,
      account: `${Aws.ACCOUNT_ID}`,
    },
    description: contextDescription
      ? contextDescription
      : "Live Event Framework Foundation Stack",
  },
  foundationConfigFile ?? DEFAULT_FOUNDATION_CONFIG,
);
Tags.of(foundationStack).add('LiveEventFrameworkVersion', liveEventFrameworkVersion);
Tags.of(foundationStack).add('StackType', 'LefFoundationStack');

// Define Event Group Stack
const eventGroupStack = new LefEventGroupStack(
  app,
  "LefEventGroupStack",
  {
    stackName: stackName,
    env: {
      region: `${Aws.REGION}`,
      account: `${Aws.ACCOUNT_ID}`,
    },
    description: contextDescription
      ? contextDescription
      : "Live Event Framework Event Group Stack",
  },
  eventGroupConfigFile ?? DEFAULT_EVENT_GROUP_CONFIG,
);
Tags.of(eventGroupStack).add('LiveEventFrameworkVersion', liveEventFrameworkVersion);
Tags.of(eventGroupStack).add('StackType', 'LefEventGroupStack');

// Define Event Stack
const eventStack = new LefEventStack(
  app,
  "LefEventStack",
  {
    stackName: stackName,
    env: {
      region: `${Aws.REGION}`,
      account: `${Aws.ACCOUNT_ID}`,
    },
    description: contextDescription
      ? contextDescription
      : "Live Event Framework Event Stack",
  },
  eventConfigFile ?? DEFAULT_EVENT_CONFIG,
);
Tags.of(eventStack).add('LiveEventFrameworkVersion', liveEventFrameworkVersion);
Tags.of(eventStack).add('StackType', 'LefEventStack');
