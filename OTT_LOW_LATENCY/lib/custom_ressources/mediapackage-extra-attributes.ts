/*********************************************************************************************************************
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           *
 *                                                                                                                    *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance    *
 *  with the License. A copy of the License is located at                                                             *
 *                                                                                                                    *
 *      http://www.apache.org/licenses/LICENSE-2.0                                                                    *
 *                                                                                                                    *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES *
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    *
 *  and limitations under the License.                                                                                *
 *********************************************************************************************************************/

import {
  custom_resources,
  Aws,
  aws_iam as iam,
  aws_lambda as lambda,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import { NagSuppressions } from "cdk-nag";

export interface IConfigProps {
  channelGroupName: string;
  channelName: string;
}

export class ExtraAttributes extends Construct {
  public readonly channelIngestEndpoint1: string;
  public readonly channelIngestEndpoint2: string;

  constructor(scope: Construct, id: string, props: IConfigProps) {
    super(scope, id);
    // 👇 Create the Lambda to retrieve the extra EMP Attributes
    const functionName = Aws.STACK_NAME + "_EMP_ExtraAttributes";
    const ssmNamePrefix = Aws.STACK_NAME;

    const getExtraAttrib = new lambda.Function(this, "extraAttribEMPLambda", {
      functionName: functionName,
      runtime: lambda.Runtime.PYTHON_3_11,
      code: lambda.Code.fromAsset(
        "lib/lambda/mediapackage_extra_attrib_function",
      ),
      handler: "index.lambda_handler",
    });

    // add the policy to the Function's role
    const policy = new iam.Policy(this, "mediaPackageAccess", {
      statements: [
        new iam.PolicyStatement({
          actions: ["mediapackagev2:GetChannel"],
          resources: [
            `arn:aws:mediapackagev2:${Aws.REGION}:${Aws.ACCOUNT_ID}:channelGroup/${Aws.STACK_NAME}/*`,
          ],
        }),
        new iam.PolicyStatement({
          actions: ["ssm:PutParameter"],
          resources: [
            `arn:aws:ssm:${Aws.REGION}:${Aws.ACCOUNT_ID}:parameter/${ssmNamePrefix}-*`,
          ],
        }),
        new iam.PolicyStatement({
          actions: [
            "logs:CreateLogGroup",
            "logs:CreateLogStream",
            "logs:PutLogEvents",
          ],
          resources: [
            `arn:aws:logs:${Aws.REGION}:${Aws.ACCOUNT_ID}:log-group:/aws/lambda/*`,
          ],
        }),
      ],
    });
    getExtraAttrib.role?.attachInlinePolicy(policy);

    // 👇 Executing the Lambda to get the payload from the Lambda function
    const extraAtribCR = new custom_resources.AwsCustomResource(
      this,
      "extraAttribEMP",
      {
        onCreate: {
          service: "Lambda",
          action: "invoke",
          parameters: {
            FunctionName: functionName,
            Payload: `{
            "mediaPackageChannelGroupName":"${props.channelGroupName}",
            "mediaPackageChannelName":"${props.channelName}",
            "ssmNamePrefix": "${ssmNamePrefix}"
          }`,
          },
          physicalResourceId: custom_resources.PhysicalResourceId.of(
            "EMPExtraAttribResourceId",
          ),
        },
        policy: custom_resources.AwsCustomResourcePolicy.fromStatements([
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["lambda:InvokeFunction"],
            resources: [getExtraAttrib.functionArn],
          }),
        ]),
      },
    );

    // Reading the ssm values and exporting the URLs for each ingest endpoint
    for (var ingestEndpoint of ["IngestEndpoint1", "IngestEndpoint2"]) {
      var ssmIngestEndpointUrl = new custom_resources.AwsCustomResource(
        this,
        `SSMParameter-${ingestEndpoint}`,
        {
          onCreate: {
            service: "SSM",
            action: "getParameter",
            parameters: { Name: `${ssmNamePrefix}-${ingestEndpoint}` },
            region: Aws.REGION,
            physicalResourceId: custom_resources.PhysicalResourceId.of(
              `${ssmNamePrefix}-${ingestEndpoint}`,
            ),
          },
          policy: custom_resources.AwsCustomResourcePolicy.fromStatements([
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ["ssm:GetParameter"],
              resources: [
                `arn:aws:ssm:${Aws.REGION}:${Aws.ACCOUNT_ID}:parameter/${ssmNamePrefix}-${ingestEndpoint}`,
              ],
            }),
          ]),
        },
      );
      ssmIngestEndpointUrl.node.addDependency(extraAtribCR);

      if (ingestEndpoint == "IngestEndpoint1") {
        this.channelIngestEndpoint1 =
          ssmIngestEndpointUrl.getResponseField("Parameter.Value");
      } else {
        this.channelIngestEndpoint2 =
          ssmIngestEndpointUrl.getResponseField("Parameter.Value");
      }
    }

    NagSuppressions.addResourceSuppressions(getExtraAttrib, [
      {
        id: "AwsSolutions-L1",
        reason:
          "This is a false alarm caused by a bug in the nag library. Lambda is running latest available Python 3.11.",
      },
    ]);
    NagSuppressions.addResourceSuppressions(policy, [
      {
        id: "AwsSolutions-IAM5",
        reason:
          "Resources are tightly scoped but a wildcard is required to allow resources to be referenced.",
      },
    ]);
  }
}
