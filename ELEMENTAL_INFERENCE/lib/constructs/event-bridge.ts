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

import { CfnOutput } from "aws-cdk-lib";
import { Rule } from "aws-cdk-lib/aws-events";
import { SqsQueue } from "aws-cdk-lib/aws-events-targets";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";

/**
 * Props for the InferenceEventBridge construct.
 */
export interface InferenceEventBridgeProps {
  /** CallbackMetadata value used to filter events to a specific feed/source */
  callbackMetadata: string;
  /** Optional resource tags */
  tags?: Record<string, string>;
}

/**
 * Encapsulates an EventBridge rule and SQS queue for routing Elemental
 * Inference clipping event metadata.
 *
 * The rule matches events with source `aws.elemental-inference` and
 * detail-type `Clip Metadata Generated`, filtered by callbackMetadata.
 * Matched events are delivered to an SQS queue with SSL enforcement.
 */
export class InferenceEventBridge extends Construct {
  /** The SQS queue URL for downstream consumption */
  public readonly queueUrl: string;
  /** The SQS queue ARN */
  public readonly queueArn: string;

  constructor(scope: Construct, id: string, props: InferenceEventBridgeProps) {
    super(scope, id);

    const queue = new Queue(this, "ClipEventQueue", {
      enforceSSL: true,
    });

    const rule = new Rule(this, "ClipMetadataRule", {
      eventPattern: {
        source: ["aws.elemental-inference"],
        detailType: ["Clip Metadata Generated"],
        detail: {
          callbackMetadata: [props.callbackMetadata],
        },
      },
    });

    rule.addTarget(new SqsQueue(queue));

    this.queueUrl = queue.queueUrl;
    this.queueArn = queue.queueArn;

    new CfnOutput(this, "QueueUrl", {
      value: this.queueUrl,
      description: "SQS queue URL for clipping events",
    });

    new CfnOutput(this, "QueueArn", {
      value: this.queueArn,
      description: "SQS queue ARN for clipping events",
    });
  }
}
