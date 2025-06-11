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

    // Tag resources
    const tags: Record<string, string>[] = [
      {
        FoundationStackName: foundationStackNameParam,
        EventGroupStackName: Aws.STACK_NAME,
        StackType: "LefEventGroupStack",
        LiveEventFrameworkVersion: scope.node.tryGetContext(
          "LiveEventFrameworkVersion",
        ),
      },
    ];
    this.tagResources(tags);

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
      },
    );

    // Create MediaTailor Configuration
    const mediaTailor = new MediaTailor(this, "MediaTailorConfiguration", {
      configurationName: eventGroupName,
      configuration: eventGroupConfig.mediaTailor,
      originHostname: channelGroup.attrEgressDomain,
    });

    // Define props to create CloudFront Distribution
    const cloudFrontProps: CloudFrontProps = {
      foundationStackName: foundationStackNameParam,
      mediaTailorHostname: mediaTailor.configHostname,
      mediaPackageHostname: channelGroup.attrEgressDomain,
      mediaPackageChannelGroupName: eventGroupName,
      s3LoggingEnabled: eventGroupConfig.cloudFront.s3LoggingEnabled,
      logFilePrefix: eventGroupName,
      nominalSegmentLength: eventGroupConfig.cloudFront.nominalSegmentLength,
      enableIpv6: eventGroupConfig.cloudFront.enableIpv6,
      enableOriginShield: eventGroupConfig.cloudFront.enableOriginShield,
      originShieldRegion: eventGroupConfig.cloudFront.originShieldRegion,
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

    // Need to perform check to confirm SNS Email Subscription is active before proceeding
    // to create the key resources in the stack
    const verifySnsTopicTrigger =
      this.verifySnsTopicSubscriptionState(snsTopic);
    mediaTailor.node.addDependency(verifySnsTopicTrigger);
    cloudfront.node.addDependency(verifySnsTopicTrigger);

    /*
     * Define MediaTailor Configration Prefixes
     */
    const emtPath = Fn.select(
      1,
      Fn.split("/v1/session/", mediaTailor.sessionEndpoint),
    );
    const emtSessionPath = Fn.select(
      1,
      Fn.split("/v1/", mediaTailor.sessionEndpoint),
    );
    const mediaTailorHlsPlaybackPrefix =
      "https://" + cloudfront.distribution.domainName + "/v1/master/" + emtPath;
    const mediaTailorDashPlaybackPrefix =
      "https://" + cloudfront.distribution.domainName + "/v1/dash/" + emtPath;
    const mediaTailorSessionPrefix =
      "https://" + cloudfront.distribution.domainName + "/v1/" + emtSessionPath;

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

    new CfnOutput(this, "MediaTailorPlaybackConfigurationArn", {
      value: mediaTailor.playbackConfigurationArn,
      exportName: Aws.STACK_NAME + "-MediaTailor-Playback-Configuration-Arn",
      description: "MediaTailor Playback Configuration ARN",
    });

    new CfnOutput(this, "CloudFrontDistributionId", {
      value: cloudfront.distribution.distributionId,
      exportName: Aws.STACK_NAME + "-CloudFront-Distribution-ID",
      description: "CloudFront Distribution ID",
    });

    new CfnOutput(this, "MediaTailorHlsPlaybackPrefix", {
      value: mediaTailorHlsPlaybackPrefix,
      exportName: Aws.STACK_NAME + "-MediaTailor-Hls-Playback-Prefix",
      description: "Prefix for playing HLS back streams with SSAI",
    });

    new CfnOutput(this, "MediaTailorDashPlaybackPrefix", {
      value: mediaTailorDashPlaybackPrefix,
      exportName: Aws.STACK_NAME + "-MediaTailor-Dash-Playback-Prefix",
      description: "Prefix for playing DASH back streams with SSAI",
    });

    new CfnOutput(this, "MediaTailorSessionPrefix", {
      value: mediaTailorSessionPrefix,
      exportName: Aws.STACK_NAME + "-MediaTailor-Session-Prefix",
      description: "Prefix for creating MediaTailor sessions",
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

    // Stack-specific validations can be added here
  }
}
