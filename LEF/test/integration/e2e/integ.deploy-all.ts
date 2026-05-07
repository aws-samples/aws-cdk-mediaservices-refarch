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
import { IntegTest } from "@aws-cdk/integ-tests-alpha";
import { LefFoundationStack } from "../../../lib/foundation/lef_foundation_stack";
import { LefEventGroupStack } from "../../../lib/event_group/lef_event_group_stack";
import { LefEventStack } from "../../../lib/event/lef_event_stack";

/**
 * Integration test for deploy-all scenario
 * Tests deploying all three stacks together with default configuration
 */

const app = new cdk.App();

const testEmail = process.env.TEST_EMAIL || "integ-test@example.com";
const stackPrefix = "LefIntegTest";

// Create Foundation Stack
const foundationStack = new LefFoundationStack(
  app,
  "IntegTestFoundation",
  {
    stackName: `${stackPrefix}Fnd`,
    description: "Integration Test - Foundation Stack",
  },
  "../../config/default/foundationConfiguration.js",
  testEmail,
);

// Create Event Group Stack
const eventGroupStack = new LefEventGroupStack(
  app,
  "IntegTestEventGroup",
  {
    stackName: `${stackPrefix}Grp`,
    description: "Integration Test - Event Group Stack",
  },
  "../../config/default/eventGroupConfiguration.js",
  foundationStack,
  true, // skipSubscriptionCheck for testing
);
eventGroupStack.addDependency(foundationStack);

// Create Event Stack
const eventStack = new LefEventStack(
  app,
  "IntegTestEvent",
  {
    stackName: `${stackPrefix}Evt`,
    description: "Integration Test - Event Stack",
  },
  "../../config/default/eventConfiguration.js",
  eventGroupStack,
);
eventStack.addDependency(eventGroupStack);

// Create integration test
const integ = new IntegTest(app, "DeployAllTest", {
  testCases: [foundationStack, eventGroupStack, eventStack],
  diffAssets: true,
  stackUpdateWorkflow: true,
  cdkCommandOptions: {
    deploy: {
      args: {
        requireApproval: "never" as any,
        json: true,
      },
    },
    destroy: {
      args: {
        force: true,
      },
    },
  },
});

// Note: No post-deployment assertions needed.
// The integ-runner validates deployment success automatically — if cdk deploy fails, the test fails.
// Post-deployment assertions using describeStacks/listStacks hit the 4KB custom resource response
// limit due to the number of stack outputs, so they are intentionally omitted.

app.synth();
