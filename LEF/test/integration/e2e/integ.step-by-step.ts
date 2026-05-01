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
 * Integration test for step-by-step deployment
 * Tests deploying Foundation -> EventGroup -> Event sequentially
 */

const app = new cdk.App();

const testEmail = process.env.TEST_EMAIL || "integ-test@example.com";
const stackPrefix = "LefStepTest";

// Create Foundation Stack
const foundationStack = new LefFoundationStack(
  app,
  "IntegTestStepFoundation",
  {
    stackName: `${stackPrefix}Fnd`,
    description: "Integration Test - Step-by-Step Foundation Stack",
  },
  "../../config/default/foundationConfiguration.js",
  testEmail,
);

// Create Event Group Stack (using direct reference for integ-runner)
const eventGroupStack = new LefEventGroupStack(
  app,
  "IntegTestStepEventGroup",
  {
    stackName: `${stackPrefix}Grp`,
    description: "Integration Test - Step-by-Step Event Group Stack",
  },
  "../../config/default/eventGroupConfiguration.js",
  foundationStack, // Direct reference so integ-runner understands dependency
  true, // Skip subscription check for testing
);

// Create Event Stack (using direct reference for integ-runner)
const eventStack = new LefEventStack(
  app,
  "IntegTestStepEvent",
  {
    stackName: `${stackPrefix}Evt`,
    description: "Integration Test - Step-by-Step Event Stack",
  },
  "../../config/default/eventConfiguration.js",
  eventGroupStack, // Direct reference so integ-runner understands dependency
);

// Create integration test with sequential deployment
const integ = new IntegTest(app, "StepByStepDeploymentTest", {
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
