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

import { Stack, StackProps, aws_iam as iam } from "aws-cdk-lib";
import { Construct } from "constructs";
import { NagSuppressions } from "cdk-nag";
import { INFERENCE_CONFIG, STACK_PREFIX_NAME } from "../config";
import { InferenceMediaConnect } from "../constructs/media-connect";
import { InferenceMediaPackage } from "../constructs/media-package";
import { ElementalInferenceFeed } from "../constructs/elemental-inference-feed";
import { InferenceMediaLive } from "../constructs/media-live";
import { InferenceEventBridge } from "../constructs/event-bridge";
import { MetadataApi } from "../constructs/metadata-api";

export class ElementalInferenceStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const config = INFERENCE_CONFIG;

    // --- MediaLive IAM Role ---
    const mediaLivePolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          resources: ["*"],
          actions: [
            // Elemental Inference FAS
            "elementalinference:AssociateFeed",
            "elementalinference:DisassociateFeed",
            "elementalinference:GetFeed",
            // MediaConnect
            "mediaconnect:ManagedDescribeFlow",
            "mediaconnect:ManagedAddOutput",
            "mediaconnect:ManagedRemoveOutput",
            // MediaPackageV2
            "mediapackagev2:PutObject",
            "mediapackagev2:GetChannel",
            // EC2 network interface operations
            "ec2:describeSubnets",
            "ec2:describeNetworkInterfaces",
            "ec2:createNetworkInterface",
            "ec2:createNetworkInterfacePermission",
            "ec2:deleteNetworkInterface",
            "ec2:deleteNetworkInterfacePermission",
            "ec2:describeSecurityGroups",
            // CloudWatch logging
            "logs:CreateLogGroup",
            "logs:CreateLogStream",
            "logs:PutLogEvents",
            "logs:DescribeLogStreams",
            "logs:DescribeLogGroups",
          ],
        }),
      ],
    });

    const mediaLiveRole = new iam.Role(this, "MediaLiveAccessRole", {
      inlinePolicies: { policy: mediaLivePolicy },
      assumedBy: new iam.ServicePrincipal("medialive.amazonaws.com"),
    });

    NagSuppressions.addResourceSuppressions(mediaLiveRole, [
      {
        id: "AwsSolutions-IAM5",
        reason:
          "Wildcard resource required — MediaLive needs access to dynamically created " +
          "network interfaces, MediaConnect flows, and MediaPackageV2 channels whose " +
          "ARNs are not known at deploy time.",
      },
    ]);

    // --- 1. MediaConnect (flow + input) ---
    const mediaConnect = new InferenceMediaConnect(this, "MediaConnect", {
      flowName: `${STACK_PREFIX_NAME}-flow`,
      inputName: `${STACK_PREFIX_NAME}-input`,
      protocol: config.mediaConnect.protocol,
      roleArn: mediaLiveRole.roleArn,
      whitelistCidr: config.mediaConnect.whitelistCidr,
      vpcConfig: config.mediaConnect.vpcConfig,
    });

    // --- 2. MediaPackageV2 (channel group + H/V channels + endpoints) ---
    const mediaPackage = new InferenceMediaPackage(this, "MediaPackage", {
      channelGroupName: config.channelGroupName,
      channelBaseName: `${STACK_PREFIX_NAME}-channel`,
    });

    // --- 3. Elemental Inference Feed ---
    const feed = new ElementalInferenceFeed(this, "InferenceFeed", {
      feedName: `${STACK_PREFIX_NAME}-feed`,
      enableClipping: config.inference.enableClipping,
      callbackMetadata: config.callbackMetadata,
    });

    // --- 4. MediaLive channel (wired to feed, input, and MediaPackage) ---
    new InferenceMediaLive(this, "MediaLive", {
      channelName: `${STACK_PREFIX_NAME}-downstream`,
      roleArn: mediaLiveRole.roleArn,
      feedArn: feed.feedArn,
      inputId: mediaConnect.inputRef,
      horizontalChannel: {
        channelGroupName: mediaPackage.channelGroupName,
        channelName: mediaPackage.horizontalChannelName,
      },
      verticalChannel: {
        channelGroupName: mediaPackage.channelGroupName,
        channelName: mediaPackage.verticalChannelName,
      },
      videoConfig: config.videoConfig,
    });

    // --- 5. EventBridge (rule + SQS queue) ---
    const eventBridge = new InferenceEventBridge(this, "EventBridge", {
      callbackMetadata: config.callbackMetadata,
    });

    NagSuppressions.addResourceSuppressions(
      eventBridge,
      [
        {
          id: "AwsSolutions-SQS3",
          reason:
            "No DLQ configured — this is a reference architecture sample.",
        },
      ],
      true,
    );

    // --- 6. Metadata API (wired to SQS queue from EventBridge) ---
    new MetadataApi(this, "MetadataApi", {
      sqsQueueUrl: eventBridge.queueUrl,
      sqsQueueArn: eventBridge.queueArn,
    });
  }
}
