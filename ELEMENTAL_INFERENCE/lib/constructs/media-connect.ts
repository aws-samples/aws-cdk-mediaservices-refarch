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
import { CfnFlow } from "aws-cdk-lib/aws-mediaconnect";
import { CfnInput } from "aws-cdk-lib/aws-medialive";
import { Construct } from "constructs";

/**
 * Props for the InferenceMediaConnect construct.
 */
export interface InferenceMediaConnectProps {
  /** Name for the MediaConnect flow */
  flowName: string;
  /** Name for the MediaLive input */
  inputName: string;
  /** Source protocol — default: "srt-listener" */
  protocol: string;
  /** MediaLive IAM role ARN for the CfnInput */
  roleArn: string;
  /** Allowlist CIDR for the source (required when not using VPC interfaces) */
  whitelistCidr?: string;
  /** Optional VPC interface configuration for the flow */
  vpcConfig?: { subnetId: string; securityGroupIds: string[] };
  /** Optional resource tags */
  tags?: Record<string, string>;
}

/**
 * Encapsulates a MediaConnect flow and a MediaLive input linked to it.
 *
 * Creates a CfnFlow with a configurable source protocol (default: srt-listener)
 * and an optional VPC interface. Creates a CfnInput of type MEDIACONNECT that
 * references the flow, suitable for use as a MediaLive channel input.
 */
export class InferenceMediaConnect extends Construct {
  /** The ARN of the MediaConnect flow */
  public readonly flowArn: string;
  /** The ref (ID) of the MediaLive CfnInput */
  public readonly inputRef: string;
  /** The SRT listener ingest endpoint (ip:port) */
  public readonly sourceIngestEndpoint: string;

  constructor(scope: Construct, id: string, props: InferenceMediaConnectProps) {
    super(scope, id);

    const vpcInterfaces: CfnFlow.VpcInterfaceProperty[] | undefined =
      props.vpcConfig
        ? [
            {
              name: `${props.flowName}-vpc`,
              roleArn: props.roleArn,
              subnetId: props.vpcConfig.subnetId,
              securityGroupIds: props.vpcConfig.securityGroupIds,
            },
          ]
        : undefined;

    const flow = new CfnFlow(this, "Flow", {
      name: props.flowName,
      source: {
        name: `${props.flowName}-source`,
        protocol: props.protocol,
        ...(props.whitelistCidr && !props.vpcConfig
          ? { whitelistCidr: props.whitelistCidr }
          : {}),
        ...(props.vpcConfig
          ? { vpcInterfaceName: `${props.flowName}-vpc` }
          : {}),
      },
      vpcInterfaces,
    });

    this.flowArn = flow.attrFlowArn;
    this.sourceIngestEndpoint = `srt://${flow.attrSourceIngestIp}:${flow.attrSourceSourceIngestPort}`;

    const input = new CfnInput(this, "Input", {
      type: "MEDIACONNECT",
      name: props.inputName,
      roleArn: props.roleArn,
      mediaConnectFlows: [{ flowArn: flow.attrFlowArn }],
      tags: props.tags,
    });
    input.node.addDependency(flow);

    this.inputRef = input.ref;

    new CfnOutput(this, "FlowArn", {
      value: this.flowArn,
      description: "MediaConnect Flow ARN",
    });

    new CfnOutput(this, "SourceIngestEndpoint", {
      value: this.sourceIngestEndpoint,
      description: "SRT listener ingest endpoint (srt://ip:port)",
    });
  }
}
