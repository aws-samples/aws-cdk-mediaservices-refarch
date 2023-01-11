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
    aws_lambda as lambda} from "aws-cdk-lib";
import { Construct } from "constructs";
import { NagSuppressions } from 'cdk-nag';

export interface IConfigProps {
  cmafEndpointId: string;
}

export class CmafOutputValue extends Construct {
  public readonly myEndpointUrl: string;
  constructor(scope: Construct, id: string, props: IConfigProps) {
    super(scope, id);
    // 👇 Create the Lambda to retrieve the CMAF endpoint URL
    const functionName=Aws.STACK_NAME + "_EMP_cmaf";
    const ssmName=Aws.STACK_NAME + "-cmaf-url";
    
    const getCmafOutput = new lambda.Function(this, "cmafOutputEMPLambda", {
        functionName:functionName ,
        runtime: lambda.Runtime.PYTHON_3_9,
        code: lambda.Code.fromAsset("lib/lambda/mediapackage_cmaf_geturl_function"),
        handler: 'index.lambda_handler',
    });
    // add the policy to the Function's role
    const cmafLambdaPolicy = new iam.PolicyStatement({
            actions: ['mediapackage:*','ssm:PutParameter'],
            resources: ['*'],
            });

    getCmafOutput.role?.attachInlinePolicy(
        new iam.Policy(this, 'mediaPackageAccess', {
            statements: [cmafLambdaPolicy],
        }));

    



    // 👇 Executing the Lambda to get the payload from the Lambda function
    const cmafOutputCR = new custom_resources.AwsCustomResource(this, "cmafOutputEMP", {
      onCreate: {
        service: "Lambda",
        action: "invoke",
        parameters: {
          FunctionName: functionName,
          Payload: `{
            "mediaPackageEndpointId":"${props.cmafEndpointId}",
            "ssmName":"${ssmName}"
          }`
        },
        physicalResourceId: custom_resources.PhysicalResourceId.of(
          "cmafEMPResourceId"
        ),
      },
      policy: custom_resources.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ["lambda:InvokeFunction"],
          resources: [getCmafOutput.functionArn],
        }),
      ])
    });

    // Reading the ssm value and exporting the URL
    const ssmCmafValue = new custom_resources.AwsCustomResource(
      this,
      "SSMParameter",
      {
        onCreate: {
          service: "SSM",
          action: "getParameter",
          parameters: { Name: ssmName },
          region: Aws.REGION,
          physicalResourceId: custom_resources.PhysicalResourceId.of(
            `${ssmName}-${Aws.REGION}`
          ),
        },
        policy: custom_resources.AwsCustomResourcePolicy.fromStatements([
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["ssm:GetParameter*"],
            resources: [
              `arn:aws:ssm:${Aws.REGION}:${Aws.ACCOUNT_ID}:parameter/${ssmName}`,
            ],
          }),
        ]),
      }
    );
    this.myEndpointUrl=ssmCmafValue.getResponseField("Parameter.Value");

    // Wait for the lambda to be executed before reading the parameter
    ssmCmafValue.node.addDependency(cmafOutputCR);


    NagSuppressions.addResourceSuppressions(ssmCmafValue, [
      {
        id: 'AwsSolutions-IAM5',
        reason: 'Remediated through property override.',
      },
    ]);
    NagSuppressions.addResourceSuppressions(ssmCmafValue, [
      {
        id: ' AwsSolutions-IAM4',
        reason: 'Remediated through property override.',
      },
    ]);
  }
}
