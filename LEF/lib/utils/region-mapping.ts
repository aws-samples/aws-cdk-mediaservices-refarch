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

import { Aws, CfnMapping, Stack } from "aws-cdk-lib";
import { Construct } from "constructs";

/**
 * Gets the 3-letter airport code for the current region
 * Creates a CloudFormation mapping for runtime resolution (one per stack)
 */
export function getRegionCode(scope: Construct): string {
  const stack = Stack.of(scope);

  // Create mapping once per stack using stack-scoped lookup
  let mapping = stack.node.tryFindChild("RegionToAirportCode") as CfnMapping;
  if (!mapping) {
    mapping = new CfnMapping(stack, "RegionToAirportCode", {
      lazy: true,
      mapping: {
        "us-east-1": { code: "IAD" }, // N. Virginia
        "us-east-2": { code: "CMH" }, // Ohio
        "us-west-1": { code: "SFO" }, // N. California
        "us-west-2": { code: "PDX" }, // Oregon
        "eu-west-1": { code: "DUB" }, // Ireland
        "eu-west-2": { code: "LHR" }, // London
        "eu-west-3": { code: "CDG" }, // Paris
        "eu-central-1": { code: "FRA" }, // Frankfurt
        "eu-central-2": { code: "ZUR" }, // Zurich
        "eu-north-1": { code: "ARN" }, // Stockholm
        "eu-south-1": { code: "MXP" }, // Milan
        "eu-south-2": { code: "ESP" }, // Spain
        "ap-southeast-1": { code: "SIN" }, // Singapore
        "ap-southeast-2": { code: "SYD" }, // Sydney
        "ap-southeast-3": { code: "JKT" }, // Jakarta
        "ap-southeast-4": { code: "MEL" }, // Melbourne
        "ap-northeast-1": { code: "NRT" }, // Tokyo
        "ap-northeast-2": { code: "ICN" }, // Seoul
        "ap-northeast-3": { code: "KIX" }, // Osaka
        "ap-south-1": { code: "BOM" }, // Mumbai
        "ap-south-2": { code: "HYD" }, // Hyderabad
        "ap-east-1": { code: "HKG" }, // Hong Kong
        "ca-central-1": { code: "YYZ" }, // Central Canada
        "ca-west-1": { code: "YVR" }, // Calgary
        "sa-east-1": { code: "GRU" }, // São Paulo
        "me-south-1": { code: "BAH" }, // Bahrain
        "me-central-1": { code: "UAE" }, // UAE
        "af-south-1": { code: "CPT" }, // Cape Town
        "il-central-1": { code: "TLV" }, // Tel Aviv
        "us-gov-east-1": { code: "GOV" }, // GovCloud East
        "us-gov-west-1": { code: "GOV" }, // GovCloud West
      },
    });
  }

  return mapping.findInMap(Aws.REGION, "code");
}
