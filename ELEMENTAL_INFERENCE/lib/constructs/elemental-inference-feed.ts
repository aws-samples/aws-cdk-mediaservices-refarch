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

import {
  aws_elementalinference as elementalinference,
  CfnOutput,
} from "aws-cdk-lib";
import { Construct } from "constructs";

/**
 * Props for the ElementalInferenceFeed construct.
 */
export interface ElementalInferenceFeedProps {
  /** Name for the Elemental Inference feed */
  feedName: string;
  /** Whether to create a Clipping output on the feed */
  enableClipping: boolean;
  /** CallbackMetadata string used for EventBridge event filtering */
  callbackMetadata: string;
  /** Optional resource tags */
  tags?: Record<string, string>;
}

/**
 * Encapsulates an AWS Elemental Inference Feed (CfnFeed L1 construct).
 *
 * Conditionally creates a Clipping output when event clipping is enabled.
 * Does NOT create a Cropping output — MediaLive auto-creates it when
 * a channel with SMART_CROP video descriptions starts.
 */
export class ElementalInferenceFeed extends Construct {
  /** The ARN of the Elemental Inference Feed */
  public readonly feedArn: string;

  constructor(scope: Construct, id: string, props: ElementalInferenceFeedProps) {
    super(scope, id);

    const outputs: elementalinference.CfnFeed.GetOutputProperty[] =
      props.enableClipping
        ? [
            {
              name: "medialive-clipping",
              outputConfig: {
                clipping: {
                  callbackMetadata: props.callbackMetadata,
                },
              },
              status: "ENABLED",
            },
          ]
        : [];

    const feed = new elementalinference.CfnFeed(this, "Feed", {
      name: props.feedName,
      outputs,
      tags: props.tags,
    });

    this.feedArn = feed.attrArn;

    new CfnOutput(this, "FeedArn", {
      value: this.feedArn,
      description: "Elemental Inference Feed ARN",
    });
  }
}
