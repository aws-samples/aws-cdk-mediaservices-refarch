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
import { Construct } from "constructs";
import { LefBaseStack } from "../lef_base_stack";
import { LefFoundationStack } from "../foundation/lef_foundation_stack";
import { IEventGroupConfig } from "./eventGroupConfigInterface";
import {
  Aws,
  aws_mediapackagev2 as mediapackagev2,
  CfnOutput,
  CfnParameter,
  Fn,
  triggers,
} from "aws-cdk-lib";
import { NagSuppressions } from "cdk-nag";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import { MediaTailor } from "./mediatailor";
import { CloudFront, CloudFrontProps } from "./cloudfront";
import { getRegionCode } from "../utils/region-mapping";
import { MediaPackageLogging } from "./mediapackage-logging";
import { TaggingUtils } from "../utils/tagging";
import {
  MediaTailorManager,
  MediaTailorConfigResult,
} from "../utils/mediatailor-manager";

export class LefEventGroupStack extends LefBaseStack {
  // Public properties for direct access by other stacks (used in bin/lef.ts)
  public readonly cloudFrontDomainName: string;
  public readonly mediaTailorHlsPlaybackPrefix: string;
  public readonly mediaTailorDashPlaybackPrefix: string;
  public readonly mediaTailorSessionPrefix: string;
  public readonly nominalDeliverySegmentSize: string;

  constructor(
    scope: Construct,
    id: string,
    props: cdk.StackProps,
    configFilePath: string,
    foundationStackOrName: LefFoundationStack | string,
    skipSubscriptionCheck: boolean = false,
    wafWebAclArn?: string,
  ) {
    super(scope, id, props);

    // Import event group configuration
    const config = this.loadConfig(configFilePath);

    // Validate event group configuration
    this.validateConfig(config);

    /*
     * Get foundation stack references
     * Support both direct stack reference (bin/lef.ts) and string (individual deployment)
     */
    let mediaLiveAccessRoleArn: string;
    let snsTopic: string;
    let foundationStackName: string;
    let foundationNominalSegmentLength: string;

    if (typeof foundationStackOrName === "string") {
      // String: use Fn.importValue (individual deployment via bin/event-group.ts)
      foundationStackName = foundationStackOrName;
      mediaLiveAccessRoleArn = Fn.importValue(
        foundationStackName + "-MediaLiveAccessRoleArn",
      );
      snsTopic = Fn.importValue(foundationStackName + "-SnsTopicArn");
      foundationNominalSegmentLength = Fn.importValue(
        foundationStackName + "-NominalSegmentLength",
      );
    } else {
      // Direct reference (complete deployment via bin/lef.ts)
      foundationStackName = foundationStackOrName.stackName as string;
      mediaLiveAccessRoleArn = foundationStackOrName.mediaLiveRoleArn;
      snsTopic = foundationStackOrName.snsTopicArn;
      foundationNominalSegmentLength =
        foundationStackOrName.nominalSegmentLength.toString();
    }

    // Verify SNS subscription (unless skipped for deploy-all mode)
    let subscriptionCheck: triggers.TriggerFunction | undefined;
    if (!skipSubscriptionCheck) {
      // FIRST: Verify SNS topic has a confirmed subscription before creating any other resources
      // This will fail the deployment immediately if subscription is not confirmed
      subscriptionCheck = this.verifySnsTopicSubscriptionState(snsTopic);
    }

    // Create standard tags for event group stack
    this.resourceTags = this.createStandardTags(
      scope,
      "LefEventGroupStack",
      foundationStackName,
      Aws.STACK_NAME,
    );

    // Getting configuration information
    var eventGroupConfig = config;

    // MediaPackage values to parameterized
    const eventGroupName = Aws.STACK_NAME;

    // Create MediaPackage V2 Channel Group
    const channelGroupTags = TaggingUtils.createResourceTags(
      this.resourceTags,
      { LefChannelGroup: eventGroupName },
    );
    const channelGroup = new mediapackagev2.CfnChannelGroup(
      this,
      "MediaPackageChannelGroup",
      {
        channelGroupName: eventGroupName,
        description: "Channel Group for " + Aws.STACK_NAME,
        tags: TaggingUtils.convertToCfnTags(channelGroupTags),
      },
    );

    // Ensure channel group is created only after subscription is verified (if check exists)
    if (subscriptionCheck) {
      channelGroup.node.addDependency(subscriptionCheck);
    }

    // Use WAF Web ACL ARN if provided (from WAF stack or config)
    let webAclArn: string | undefined;
    if (eventGroupConfig.cloudFront.waf?.enabled) {
      // Priority: 1) Passed from WAF stack, 2) From config file
      webAclArn = wafWebAclArn || eventGroupConfig.cloudFront.waf.webAclArn;

      if (webAclArn) {
        // Output WAF Web ACL ARN being used
        new CfnOutput(this, "WafWebAclArn", {
          value: webAclArn,
          description: "WAF Web ACL ARN for CloudFront distribution",
        });
      } else {
        throw new Error(
          "WAF is enabled but no Web ACL ARN provided.  Update configuration to " +
            "either provide webAclArn or enable a rule to trigger a new Web ACL creation.",
        );
      }
    }

    // Define props to create CloudFront Distribution
    const cloudFrontProps: CloudFrontProps = {
      foundationStackName: foundationStackName,
      mediaPackageHostname: channelGroup.attrEgressDomain,
      mediaPackageChannelGroupName: eventGroupName,
      s3LoggingEnabled: eventGroupConfig.cloudFront.s3LoggingEnabled,
      logFilePrefix: eventGroupName,
      nominalSegmentLength: eventGroupConfig.cloudFront.nominalSegmentLength,
      enableIpv6: eventGroupConfig.cloudFront.enableIpv6,
      enableOriginShield: eventGroupConfig.cloudFront.enableOriginShield,
      originShieldRegion: eventGroupConfig.cloudFront.originShieldRegion,
      webAclArn: webAclArn,
      tags: this.resourceTags,
    };

    // Set tokenizationFunctionArn if specified in configuration
    const configuredValue = eventGroupConfig.cloudFront.tokenizationFunctionArn;
    if (configuredValue && configuredValue.trim().length > 0) {
      cloudFrontProps.tokenizationFunctionArn = configuredValue;
    }

    // Set the Trusted Key Groups if specified in configuration
    const trustedKeyGroups = eventGroupConfig.cloudFront.keyGroupId;
    if (trustedKeyGroups && trustedKeyGroups.length > 0) {
      cloudFrontProps.keyGroupIds = trustedKeyGroups;
    }

    // Create CloudFront Distribution
    const cloudfront = new CloudFront(
      this,
      "CloudFrontDistribution",
      cloudFrontProps,
    );
    // Ensure cloudfront resources are created only after subscription is verified (if check exists)
    if (subscriptionCheck) {
      cloudfront.node.addDependency(subscriptionCheck);
    }

    // Create MediaTailor Configurations
    const mediaTailorTags = TaggingUtils.createResourceTags(this.resourceTags, {
      LefChannelGroup: eventGroupName,
    });

    const mediaTailorConfigs = MediaTailorManager.createConfigurations(
      this,
      eventGroupConfig.mediaTailor,
      eventGroupName,
      "MediaTailorConfiguration",
      channelGroup.attrEgressDomain,
      cloudfront.distribution.domainName,
      mediaTailorTags,
    );

    // Ensure mediatailor configs are created only after subscription is verified (if check exists)
    if (subscriptionCheck) {
      // Add dependency on SNS verification for all MediaTailor configurations
      mediaTailorConfigs.forEach((config) => {
        config.instance.node.addDependency(subscriptionCheck);
      });
    }

    // Create MediaTailor outputs using utility
    MediaTailorManager.createOutputs(
      this,
      mediaTailorConfigs,
      cloudfront.distribution.domainName,
      "",
      Aws.STACK_NAME,
    );

    // Keep legacy outputs for backward compatibility
    const primaryMediaTailor = mediaTailorConfigs[0].instance;
    const emtPath = Fn.select(
      1,
      Fn.split("/v1/session/", primaryMediaTailor.sessionEndpoint),
    );
    const emtSessionPath = Fn.select(
      1,
      Fn.split("/v1/", primaryMediaTailor.sessionEndpoint),
    );
    const mediaTailorHlsPlaybackPrefix =
      "https://" + cloudfront.distribution.domainName + `/v1/master/` + emtPath;
    const mediaTailorDashPlaybackPrefix =
      "https://" + cloudfront.distribution.domainName + `/v1/dash/` + emtPath;
    const mediaTailorSessionPrefix =
      "https://" + cloudfront.distribution.domainName + `/v1/` + emtSessionPath;

    new CfnOutput(this, "FoundationStackName", {
      value: foundationStackName,
      exportName: Aws.STACK_NAME + "-Foundation-Stack-Name",
      description: "Name of the Foundation Stack used by Event Group.",
    });

    new CfnOutput(this, "SnsTopic", {
      value: snsTopic,
      exportName: Aws.STACK_NAME + "-SnsTopicArn",
      description: "SNS topic ARN for Lef/ssai events.",
    });

    new CfnOutput(this, "MediaLiveAccessRoleArn", {
      value: mediaLiveAccessRoleArn,
      exportName: Aws.STACK_NAME + "-MediaLiveAccessRoleArn",
      description: "MediaLive Access Role for MediaLive to use for events.",
    });

    new CfnOutput(this, "CloudFrontDistributionId", {
      value: cloudfront.distribution.distributionId,
      exportName: Aws.STACK_NAME + "-CloudFront-Distribution-ID",
      description: "CloudFront Distribution ID",
    });

    new CfnOutput(this, "CloudFrontDomainName", {
      value: cloudfront.distribution.domainName,
      exportName: Aws.STACK_NAME + "-CloudFront-Domain-Name",
      description: "CloudFront Distribution Domain Name",
    });

    new CfnOutput(this, "CloudFrontNominalSegmentLength", {
      value: eventGroupConfig.cloudFront.nominalSegmentLength.toString(),
      exportName: Aws.STACK_NAME + "-Nominal-Delivery-Segment-Size",
      description:
        "Nominal segment size used for configuration of CloudFront timeouts",
    });

    // Create MediaPackage logging if enabled
    if (eventGroupConfig.mediaPackageLogging?.enabled) {
      const loggingTags = TaggingUtils.createResourceTags(this.resourceTags, {
        LefChannelGroup: eventGroupName,
      });

      const mediaPackageLogging = new MediaPackageLogging(
        this,
        "MediaPackageLogging",
        {
          channelGroupArn: channelGroup.attrArn,
          channelGroupName: eventGroupName,
          configuration: eventGroupConfig.mediaPackageLogging,
          tags: loggingTags,
        },
      );

      // Add dependency to ensure channel group is created first
      mediaPackageLogging.node.addDependency(channelGroup);

      // Export logging resource ARNs if logging is enabled
      if (mediaPackageLogging.logGroupArns.length > 0) {
        new CfnOutput(this, "MediaPackageLogGroups", {
          value: mediaPackageLogging.logGroupArns.join("|"),
          exportName: Aws.STACK_NAME + "-MediaPackage-Log-Groups",
          description: "MediaPackage CloudWatch Log Group ARNs",
        });
      }

      if (mediaPackageLogging.s3Buckets.length > 0) {
        new CfnOutput(this, "MediaPackageLogBuckets", {
          value: mediaPackageLogging.s3Buckets
            .map((bucket) => bucket.bucketArn)
            .join("|"),
          exportName: Aws.STACK_NAME + "-MediaPackage-Log-Buckets",
          description: "MediaPackage S3 Log Bucket ARNs",
        });
      }
    }

    // Set public properties for direct access by other stacks (used in bin/lef.ts)
    this.cloudFrontDomainName = cloudfront.distribution.domainName;
    this.mediaTailorHlsPlaybackPrefix = mediaTailorHlsPlaybackPrefix;
    this.mediaTailorDashPlaybackPrefix = mediaTailorDashPlaybackPrefix;
    this.mediaTailorSessionPrefix = mediaTailorSessionPrefix;
    this.nominalDeliverySegmentSize =
      eventGroupConfig.cloudFront.nominalSegmentLength.toString();

    // Add deletion protection check
    this.addDeletionProtectionCheck("CloudFront-Domain-Name");
  }

  addDeletionProtectionCheck(exportSuffix: string) {
    const role = new iam.Role(this, "DeletionCheckRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      roleName: `${Aws.STACK_NAME}-${getRegionCode(this)}-DeletionCheckRole`,
    });
    TaggingUtils.applyTagsToResource(role, this.resourceTags);

    role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["cloudformation:ListImports"],
        resources: ["*"],
      }),
    );

    role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ],
        resources: [`arn:aws:logs:${Aws.REGION}:${Aws.ACCOUNT_ID}:log-group:*`],
      }),
    );

    const fn = new lambda.Function(this, "DeletionCheck", {
      functionName: `${Aws.STACK_NAME}-${getRegionCode(this)}-DeletionCheck`,
      runtime: lambda.Runtime.PYTHON_3_14,
      handler: "index.lambda_handler",
      code: lambda.Code.fromAsset(
        __dirname + "/../../lambda/check_stack_dependencies",
      ),
      role: role,
      environment: {
        STACK_NAME: Aws.STACK_NAME,
        EXPORT_SUFFIX: exportSuffix,
      },
      reservedConcurrentExecutions: 1,
    });
    TaggingUtils.applyTagsToResource(fn, this.resourceTags);

    fn.grantInvoke(new iam.ServicePrincipal("cloudformation.amazonaws.com"));

    // Apply NAG suppression to the role's default policy
    const defaultPolicy = role.node.findChild("DefaultPolicy") as iam.Policy;
    if (defaultPolicy) {
      NagSuppressions.addResourceSuppressions(defaultPolicy, [
        {
          id: "AwsSolutions-IAM5",
          reason:
            "ListImports requires wildcard. Log group wildcard needed for unpredictable names.",
        },
      ]);
    }

    new cdk.CustomResource(this, "DeletionProtection", {
      serviceToken: fn.functionArn,
    });
  }

  // Function to verify SNS Topic deployed in foundation stack has at least 1 confirmed subscription
  verifySnsTopicSubscriptionState(snsTopic: string) {
    // Create an IAM role for the Lambda function
    const lambdaRole = new iam.Role(
      this,
      "CheckValidSnsSubscriptionExistsRole",
      {
        assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
        roleName: `${Aws.STACK_NAME}-${getRegionCode(this)}-CheckValidSnsSubscriptionExistsRole`,
        description:
          "Role for the CheckValidSnsSubscriptionExists Lambda function",
      },
    );
    TaggingUtils.applyTagsToResource(lambdaRole, this.resourceTags);

    // Create a custom policy statement for SNS permissions
    const snsPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["sns:GetTopicAttributes", "sns:ListSubscriptionsByTopic"],
      resources: [snsTopic],
    });

    // Create a custom policy statement for CloudWatch permissions
    const cloudWatchPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
      ],
      resources: [`arn:aws:logs:${Aws.REGION}:${Aws.ACCOUNT_ID}:log-group:*`],
    });

    // Attach the custom policy statements to the IAM role
    lambdaRole.addToPolicy(snsPolicy);
    lambdaRole.addToPolicy(cloudWatchPolicy);

    // Apply NAG suppression to the role's default policy
    const defaultPolicy = lambdaRole.node.findChild(
      "DefaultPolicy",
    ) as iam.Policy;
    if (defaultPolicy) {
      NagSuppressions.addResourceSuppressions(defaultPolicy, [
        {
          id: "AwsSolutions-IAM5",
          reason:
            "Resource is limited to log-groups in the account/region but a wildcard needs to " +
            "be specified at the end of the resources due to the full resource name being unpredictable.",
        },
      ]);
    }

    // Run trigger to verify SnsTopic has a confirmed subscription
    const trigger = new triggers.TriggerFunction(
      this,
      "CheckValidSnsSubscriptioExists",
      {
        functionName: `${Aws.STACK_NAME}-${getRegionCode(this)}-CheckValidSnsSubscriptionExists`,
        runtime: lambda.Runtime.PYTHON_3_14,
        handler: "index.lambda_handler",
        code: lambda.Code.fromAsset(
          __dirname + "/../../lambda/check_valid_sns_subscription_exists",
        ),
        role: lambdaRole,
        environment: {
          SNS_TOPIC_ARN: snsTopic,
        },
        reservedConcurrentExecutions: 1,
      },
    );
    TaggingUtils.applyTagsToResource(trigger, this.resourceTags);

    return trigger;
  }

  loadConfig(configFilePath: string): IEventGroupConfig {
    return this.getConfig<IEventGroupConfig>(
      configFilePath,
      "EVENT_GROUP_CONFIG",
    );
  }

  // validate event group configuration
  validateConfig(config: IEventGroupConfig): void {
    if (
      config.cloudFront.tokenizationFunctionArn &&
      config.cloudFront.keyGroupId
    ) {
      throw new Error(
        "CloudFront configuration cannot have both tokenizationFunctionArn and keyGroupId",
      );
    }

    // Verify CloudFront Origin Shield is configured correctly
    if (config.cloudFront.enableOriginShield) {
      if (!config.cloudFront.originShieldRegion) {
        throw new Error(
          "When origin shield is enabled, originShieldRegion must be set",
        );
      }
      if (config.cloudFront.originShieldRegion.trim().length === 0) {
        throw new Error(
          "When origin shield is enabled, originShieldRegion cannot be an empty string",
        );
      }
    }

    // Verify that at least one MediaTailor configuration exists
    if (!config.mediaTailor || config.mediaTailor.length === 0) {
      throw new Error(
        "At least one MediaTailor configuration must be provided",
      );
    }

    // Verify MediaTailor configuration names
    const configNames = config.mediaTailor.map((config) => config.name || "");

    // Count undefined/empty names - only one is allowed
    const unnamedCount = configNames.filter((name) => !name).length;
    if (unnamedCount > 1) {
      throw new Error(
        "Only one MediaTailor configuration can have an undefined or empty name",
      );
    }

    // For configurations with names, verify they are unique and valid
    const namedConfigs = configNames.filter((name) => name !== "");
    const uniqueNames = new Set(namedConfigs);
    if (uniqueNames.size !== namedConfigs.length) {
      throw new Error(
        "All named MediaTailor configurations must have unique names",
      );
    }

    // Verify that all MediaTailor configuration names are valid when present
    const nameRegex = /^[a-zA-Z0-9-_]+$/;
    for (const name of namedConfigs) {
      if (!nameRegex.test(name)) {
        throw new Error(
          `MediaTailor configuration name '${name}' contains invalid characters. Use only alphanumeric characters, hyphens, and underscores.`,
        );
      }
    }

    // Stack-specific validations can be added here
  }
}
