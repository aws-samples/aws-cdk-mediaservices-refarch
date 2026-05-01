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
import { Aws, aws_wafv2 as wafv2, CfnOutput, CfnParameter } from "aws-cdk-lib";
import { Construct } from "constructs";
import { LefBaseStack } from "../lef_base_stack";
import { TaggingUtils } from "../utils/tagging";

export interface LefEventGroupWafStackProps extends cdk.StackProps {
  eventGroupName: string;
  allowedIpv4Addresses?: string[];
  allowedCountryCodes?: string[];
  blockAnonymousIps?: boolean;
}

export class LefEventGroupWafStack extends LefBaseStack {
  public readonly webAclArn: string;
  public readonly webAclId: string;

  constructor(scope: Construct, id: string, props: LefEventGroupWafStackProps) {
    super(scope, id, {
      ...props,
      env: {
        account: props.env?.account,
        region: "us-east-1", // WAF for CloudFront must be in us-east-1
      },
      description: props.description || "Live Event Framework WAF Stack",
    });

    // Validate that at least one rule is configured
    this.validateConfig(props);

    // Define foundationStackName parameter for compatibility with Event Group deployment
    // This parameter is not used by the WAF stack but allows both stacks to be deployed
    // with the same parameter set
    new cdk.CfnParameter(this, "foundationStackName", {
      type: "String",
      description: "Name of the Foundation Stack (not used by WAF stack)",
      default: "",
    });

    // Create standard tags for WAF stack
    this.resourceTags = this.createStandardTags(
      scope,
      "LefEventGroupWafStack",
      Aws.STACK_NAME,
    );

    // Create WAF Web ACL with AWS Managed Rules
    const wafTags = TaggingUtils.createResourceTags(this.resourceTags, {
      LefChannelGroup: props.eventGroupName,
    });

    // Create IP Set for allowed IPv4 addresses if provided
    let ipSetArn: string | undefined;
    if (props.allowedIpv4Addresses && props.allowedIpv4Addresses.length > 0) {
      const ipSet = new wafv2.CfnIPSet(this, "AllowedIPv4Set", {
        scope: "CLOUDFRONT",
        ipAddressVersion: "IPV4",
        addresses: props.allowedIpv4Addresses,
        name: `${props.eventGroupName}-AllowedIPv4`,
        description: `Allowed IPv4 addresses for ${props.eventGroupName}`,
        tags: TaggingUtils.convertToCfnTags(wafTags),
      });
      ipSetArn = ipSet.attrArn;
    }

    const webAcl = new wafv2.CfnWebACL(this, "WebACL", {
      scope: "CLOUDFRONT",
      defaultAction: { allow: {} },
      name: `${props.eventGroupName}-WebACL`,
      description: `WAF Web ACL for ${props.eventGroupName}`,
      rules: this.createRules(
        ipSetArn,
        props.allowedCountryCodes,
        props.blockAnonymousIps ?? false,
      ),
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: `${props.eventGroupName}-WebACL`,
      },
      tags: TaggingUtils.convertToCfnTags(wafTags),
    });

    this.webAclArn = webAcl.attrArn;
    this.webAclId = webAcl.attrId;

    // Export WAF Web ACL ARN
    new CfnOutput(this, "WafWebAclArn", {
      value: this.webAclArn,
      description: "WAF Web ACL ARN for CloudFront distribution",
    });

    new CfnOutput(this, "WafWebAclId", {
      value: this.webAclId,
      description: "WAF Web ACL ID",
    });
  }

  protected validateConfig(props: LefEventGroupWafStackProps): void {
    const hasIpAllowList =
      props.allowedIpv4Addresses && props.allowedIpv4Addresses.length > 0;
    const hasGeoBlocking =
      props.allowedCountryCodes && props.allowedCountryCodes.length > 0;
    const hasAnonymousIpBlocking = props.blockAnonymousIps ?? false;

    const hasAtLeastOneRule =
      hasIpAllowList || hasGeoBlocking || hasAnonymousIpBlocking;

    if (!hasAtLeastOneRule) {
      throw new Error(
        "WAF Web ACL must have at least one rule configured. \n" +
          "Please provide an existing webAclArn in the configuration\n" +
          "or enable one of the following:\n" +
          "  - allowedIpv4Addresses (IP allow list)\n" +
          "  - allowedCountryCodes (geo-blocking)\n" +
          "  - blockAnonymousIps: true (anonymous IP blocking)\n",
      );
    }
  }

  private createRules(
    ipSetArn?: string,
    allowedCountryCodes?: string[],
    blockAnonymousIps: boolean = false,
  ): wafv2.CfnWebACL.RuleProperty[] {
    const rules: wafv2.CfnWebACL.RuleProperty[] = [];
    let priority = 0;

    // Rule 1: Allow traffic from allowed IP addresses (highest priority)
    if (ipSetArn) {
      rules.push({
        name: "AllowListedIPv4Addresses",
        priority: priority++,
        statement: {
          ipSetReferenceStatement: {
            arn: ipSetArn,
          },
        },
        action: { allow: {} },
        visibilityConfig: {
          sampledRequestsEnabled: true,
          cloudWatchMetricsEnabled: true,
          metricName: "AllowListedIPv4Addresses",
        },
      });
    }

    // Rule 2: Geo-blocking - Block countries not in allowed list
    if (allowedCountryCodes && allowedCountryCodes.length > 0) {
      rules.push({
        name: "GeoBlocking",
        priority: priority++,
        statement: {
          notStatement: {
            statement: {
              geoMatchStatement: {
                countryCodes: allowedCountryCodes,
              },
            },
          },
        },
        action: { block: {} },
        visibilityConfig: {
          sampledRequestsEnabled: true,
          cloudWatchMetricsEnabled: true,
          metricName: "GeoBlocking",
        },
      });
    }

    // Rule 3: AWS Managed Rules - Anonymous IP List (optional)
    if (blockAnonymousIps) {
      rules.push({
        name: "AWSManagedRulesAnonymousIpList",
        priority: priority++,
        statement: {
          managedRuleGroupStatement: {
            vendorName: "AWS",
            name: "AWSManagedRulesAnonymousIpList",
          },
        },
        overrideAction: { none: {} },
        visibilityConfig: {
          sampledRequestsEnabled: true,
          cloudWatchMetricsEnabled: true,
          metricName: "AWSManagedRulesAnonymousIpList",
        },
      });
    }

    return rules;
  }
}
