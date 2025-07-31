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
import { TaggingUtils } from "../utils/tagging";

export class LefEventGroupStack extends LefBaseStack {
  constructor(
    scope: Construct,
    id: string,
    props: cdk.StackProps,
    configFilePath: string,
  ) {
    super(scope, id, props);

    // Import event group configuration
    const config = this.loadConfig(configFilePath);

    // Validate event group configuration
    this.validateConfig(config);

    /*
     * Define Stack Parameters
     */
    const foundationStackNameParam = new CfnParameter(
      this,
      "foundationStackName",
      {
        type: "String",
        description:
          "Name of the Foundation Stack Event Group will be based upon.",
        allowedPattern: ".+",
        constraintDescription: "Foundation Stack Name cannot be empty",
      },
    ).valueAsString;
    const mediaLiveAccessRoleArn = Fn.importValue(
      foundationStackNameParam + "-MediaLiveAccessRoleArn",
    );

    const snsTopic = Fn.importValue(foundationStackNameParam + "-SnsTopicArn");

    // Create standard tags for event group stack
    this.resourceTags = this.createStandardTags(
      scope, 
      "LefEventGroupStack", 
      foundationStackNameParam,
      Aws.STACK_NAME,
    );

    // Getting configuration information
    var eventGroupConfig = config;

    // MediaPackage values to parameterized
    const eventGroupName = Aws.STACK_NAME;

    // Create MediaPackage V2 Channel Group
    const channelGroup = new mediapackagev2.CfnChannelGroup(
      this,
      "MediaPackageChannelGroup",
      {
        channelGroupName: eventGroupName,
        description: "Channel Group for " + Aws.STACK_NAME,
        tags: TaggingUtils.convertToCfnTags(this.resourceTags),
      },
    );

    // Need to perform check to confirm SNS Email Subscription is active before proceeding
    // to create the key resources in the stack
    const verifySnsTopicTrigger =
      this.verifySnsTopicSubscriptionState(snsTopic);

    // Create MediaTailor Configurations
    const mediaTailorConfigs = eventGroupConfig.mediaTailor.map((config, index) => {
      let mediaTailorConfigResourceId = 'MediaTailorConfiguration'
      if ( config.name && config.name != "") {
        mediaTailorConfigResourceId = `${mediaTailorConfigResourceId}-${config.name}`
      }
      const mediaTailor = new MediaTailor(this, mediaTailorConfigResourceId, {
        configurationName: eventGroupName,
        configurationNameSuffix: config.name,
        configuration: config,
        originHostname: channelGroup.attrEgressDomain,
        tags: this.resourceTags,
      });
      
      // Need to perform check to confirm SNS Email Subscription is active before proceeding
      mediaTailor.node.addDependency(verifySnsTopicTrigger);
      
      return {
        instance: mediaTailor,
        name: eventGroupName,
        nameSuffix: config.name,
        hostname: mediaTailor.configHostname
      };
    });

    // Create a list of all the MediaTailor ARNs in the group
    const mediaTailorArnList = mediaTailorConfigs.map((config) => config.instance.playbackConfigurationArn);
    new CfnOutput(this, "MediaTailorPlaybackConfigurationArnList", {
      value: mediaTailorArnList.join("|"),
      exportName: Aws.STACK_NAME + "-MediaTailor-Playback-Configuration-Arn-List",
      description: "List of all MediaTailor Playback Configuration ARNs in the group",
    });

    // Define props to create CloudFront Distribution
    const cloudFrontProps: CloudFrontProps = {
      foundationStackName: foundationStackNameParam,
      mediaPackageHostname: channelGroup.attrEgressDomain,
      mediaPackageChannelGroupName: eventGroupName,
      s3LoggingEnabled: eventGroupConfig.cloudFront.s3LoggingEnabled,
      logFilePrefix: eventGroupName,
      nominalSegmentLength: eventGroupConfig.cloudFront.nominalSegmentLength,
      enableIpv6: eventGroupConfig.cloudFront.enableIpv6,
      enableOriginShield: eventGroupConfig.cloudFront.enableOriginShield,
      originShieldRegion: eventGroupConfig.cloudFront.originShieldRegion,
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
    
    cloudfront.node.addDependency(verifySnsTopicTrigger);

    /*
     * Define MediaTailor Configuration Prefixes for the primary configuration
     */
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
      value: foundationStackNameParam,
      exportName: Aws.STACK_NAME + "-Foundation-Stack-Name",
      description: "Name of the Foundation Stack used bye Event Group.",
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

    // Output information for each MediaTailor configuration
    if ( mediaTailorConfigs.length > 1 ) {
      mediaTailorConfigs.forEach((config, index) => {
        new CfnOutput(this, `MediaTailorPlaybackConfigurationArn-${config.nameSuffix}`, {
          value: config.instance.playbackConfigurationArn,
          exportName: Aws.STACK_NAME + `-MediaTailor-${config.nameSuffix}-Playback-Configuration-Arn`,
          description: `MediaTailor ${config.nameSuffix} Playback Configuration ARN`,
        });
        
        const configEmtPath = Fn.select(
          1,
          Fn.split("/v1/session/", config.instance.sessionEndpoint),
        );
        const configEmtSessionPath = Fn.select(
          1,
          Fn.split("/v1/", config.instance.sessionEndpoint),
        );
        
        new CfnOutput(this, `MediaTailorHlsPlaybackPrefix-${config.nameSuffix}`, {
          value: "https://" + cloudfront.distribution.domainName + `/v1/master/` + configEmtPath,
          exportName: Aws.STACK_NAME + `-MediaTailor-${config.nameSuffix}-Hls-Playback-Prefix`,
          description: `Prefix for playing HLS back streams with SSAI using ${config.nameSuffix} configuration`,
        });
        
        new CfnOutput(this, `MediaTailorDashPlaybackPrefix-${config.nameSuffix}`, {
          value: "https://" + cloudfront.distribution.domainName + `/v1/dash/` + configEmtPath,
          exportName: Aws.STACK_NAME + `-MediaTailor-${config.nameSuffix}-Dash-Playback-Prefix`,
          description: `Prefix for playing DASH back streams with SSAI using ${config.nameSuffix} configuration`,
        });
        
        new CfnOutput(this, `MediaTailorSessionPrefix-${config.nameSuffix}`, {
          value: "https://" + cloudfront.distribution.domainName + `/v1/` + configEmtSessionPath,
          exportName: Aws.STACK_NAME + `-MediaTailor-${config.nameSuffix}-Session-Prefix`,
          description: `Prefix for creating MediaTailor sessions using ${config.nameSuffix} configuration`,
        });
      });
    }

    new CfnOutput(this, "CloudFrontDistributionId", {
      value: cloudfront.distribution.distributionId,
      exportName: Aws.STACK_NAME + "-CloudFront-Distribution-ID",
      description: "CloudFront Distribution ID",
    });

    // Keep the original outputs for backward compatibility
    new CfnOutput(this, "MediaTailorHlsPlaybackPrefix", {
      value: mediaTailorHlsPlaybackPrefix,
      exportName: Aws.STACK_NAME + "-MediaTailor-Hls-Playback-Prefix",
      description: "Prefix for playing HLS back streams with SSAI (primary configuration)",
    });

    new CfnOutput(this, "MediaTailorDashPlaybackPrefix", {
      value: mediaTailorDashPlaybackPrefix,
      exportName: Aws.STACK_NAME + "-MediaTailor-Dash-Playback-Prefix",
      description: "Prefix for playing DASH back streams with SSAI (primary configuration)",
    });

    new CfnOutput(this, "MediaTailorSessionPrefix", {
      value: mediaTailorSessionPrefix,
      exportName: Aws.STACK_NAME + "-MediaTailor-Session-Prefix",
      description: "Prefix for creating MediaTailor sessions (primary configuration)",
    });
    
    new CfnOutput(this, "MediaTailorPlaybackConfigurationArn", {
      value: primaryMediaTailor.playbackConfigurationArn,
      exportName: Aws.STACK_NAME + "-MediaTailor-Playback-Configuration-Arn",
      description: "MediaTailor Playback Configuration ARN (primary configuration)",
    });

    new CfnOutput(this, "CloudFrontNominalSegmentLength", {
      value: eventGroupConfig.cloudFront.nominalSegmentLength.toString(),
      exportName: Aws.STACK_NAME + "-Nominal-Delivery-Segment-Size",
      description:
        "Nominal segment size used for configuration of CloudFront timeouts",
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
        roleName: Aws.STACK_NAME + "-CheckValidSnsSubscriptionExistsRole",
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
      resources: [`arn:aws:logs:${Aws.REGION}:${Aws.ACCOUNT_ID}:log-group`],
    });

    // Attach the custom policy statements to the IAM role
    lambdaRole.addToPolicy(snsPolicy);
    lambdaRole.addToPolicy(cloudWatchPolicy);

    // Run trigger to verify SnsTopic has a confirmed subscription
    const trigger = new triggers.TriggerFunction(
      this,
      "CheckValidSnsSubscriptioExists",
      {
        functionName: Aws.STACK_NAME + "-CheckValidSnsSubscriptionExists",
        runtime: lambda.Runtime.PYTHON_3_13,
        handler: "index.lambda_handler",
        code: lambda.Code.fromAsset(
          __dirname + "/../../lambda/check_valid_sns_subscription_exists",
        ),
        role: lambdaRole,
        environment: {
          SNS_TOPIC_ARN: snsTopic,
        },
      },
    );
    TaggingUtils.applyTagsToResource(trigger, this.resourceTags);

    NagSuppressions.addResourceSuppressions(lambdaRole, [
      {
        id: "AwsSolutions-IAM5",
        reason:
          "Resource is limited to log-groups in the account/region but a wildcard needs to " +
          "be specified at the end of the resources due to the full resource name being unpredictable.",
      },
    ]);

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
        "At least one MediaTailor configuration must be provided"
      );
    }
    
    // Verify MediaTailor configuration names
    const configNames = config.mediaTailor.map(config => config.name || '');
    
    // Count undefined/empty names - only one is allowed
    const unnamedCount = configNames.filter(name => !name).length;
    if (unnamedCount > 1) {
      throw new Error(
        "Only one MediaTailor configuration can have an undefined or empty name"
      );
    }
    
    // For configurations with names, verify they are unique and valid
    const namedConfigs = configNames.filter(name => name !== '');
    const uniqueNames = new Set(namedConfigs);
    if (uniqueNames.size !== namedConfigs.length) {
      throw new Error(
        "All named MediaTailor configurations must have unique names"
      );
    }
    
    // Verify that all MediaTailor configuration names are valid when present
    const nameRegex = /^[a-zA-Z0-9-_]+$/;
    for (const name of namedConfigs) {
      if (!nameRegex.test(name)) {
        throw new Error(
          `MediaTailor configuration name '${name}' contains invalid characters. Use only alphanumeric characters, hyphens, and underscores.`
        );
      }
    }

    // Stack-specific validations can be added here
  }
}
