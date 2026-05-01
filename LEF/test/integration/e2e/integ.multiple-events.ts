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
 * Integration test for multiple events in same group
 * Tests deploying Foundation -> EventGroup -> Event1 + Event2
 */

const app = new cdk.App();

const testEmail = process.env.TEST_EMAIL || "integ-test@example.com";
const stackPrefix = "LefMultiTest";

// Create Foundation Stack
const foundationStack = new LefFoundationStack(
  app,
  "IntegTestMultiFoundation",
  {
    stackName: `${stackPrefix}Fnd`,
    description: "Integration Test - Multiple Events Foundation Stack",
  },
  "../../config/default/foundationConfiguration.js",
  testEmail,
);

// Create Event Group Stack
const eventGroupStack = new LefEventGroupStack(
  app,
  "IntegTestMultiEventGroup",
  {
    stackName: `${stackPrefix}Grp`,
    description: "Integration Test - Multiple Events Event Group Stack",
  },
  "../../config/default/eventGroupConfiguration.js",
  foundationStack,
  true,
);
eventGroupStack.addDependency(foundationStack);

// Create Event Stack 1
const eventStack1 = new LefEventStack(
  app,
  "IntegTestMultiEvent1",
  {
    stackName: `${stackPrefix}Ev1`,
    description: "Integration Test - Multiple Events Event Stack 1",
  },
  "../../config/default/eventConfiguration.js",
  eventGroupStack,
);
eventStack1.addDependency(eventGroupStack);

// Create Event Stack 2
const eventStack2 = new LefEventStack(
  app,
  "IntegTestMultiEvent2",
  {
    stackName: `${stackPrefix}Ev2`,
    description: "Integration Test - Multiple Events Event Stack 2",
  },
  "../../config/default/eventConfiguration.js",
  eventGroupStack,
);
eventStack2.addDependency(eventGroupStack);

// Create integration test
const integ = new IntegTest(app, "MultipleEventsTest", {
  testCases: [foundationStack, eventGroupStack, eventStack1, eventStack2],
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
