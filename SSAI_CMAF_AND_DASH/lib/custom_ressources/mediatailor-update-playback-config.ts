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
    Aws,
    aws_iam as iam,
    Fn,
    aws_lambda as lambda,
    CustomResource } from "aws-cdk-lib";

import { Construct } from "constructs";
import { Provider } from "aws-cdk-lib/custom-resources";

export interface IConfigProps {
    playbackConfigurationArn: string;
    adSegmentUrlPrefix: string;
    contentSegmentUrlPrefix: string;
    customTranscodeProfile: string;
}

export class UpdatePlaybackConfig extends Construct {
  provider: Provider;
  serviceToken: string;

  constructor(scope: Construct, id: string, props: IConfigProps) {
    super(scope, id);

    //extracting the MediaTailor Playback Config Name from the ARN 
    const playbackConfigurationName = Fn.select(1, Fn.split("playbackConfiguration/", props.playbackConfigurationArn));

    // 👇 Create the Lambda to start MediaLive
    const updateMediaTailorConfigLambda = new lambda.Function(this, "updatePlaybackConfigLambda", {
        functionName: Aws.STACK_NAME + "_EMT_Update",
        runtime: lambda.Runtime.PYTHON_3_10,
        code: lambda.Code.fromAsset("lib/lambda/mediatailor_update_playback_config_function"),
        handler: 'index.lambda_handler',
    });
    // add the policy to the Function's role
    const mediaTailorLambdaPolicy = new iam.PolicyStatement({
            actions: [
              "mediaTailor:GetPlaybackConfiguration",
              "mediaTailor:PutPlaybackConfiguration",
              "mediatailor:TagResource"
            ],
            resources: [props.playbackConfigurationArn],
            });
    updateMediaTailorConfigLambda.role?.attachInlinePolicy(
        new iam.Policy(this, 'mediaTailorUpdateConfig', {
            statements: [mediaTailorLambdaPolicy],
        }),
    );

    // create actual provider using the Lambda function and the vpc
    this.provider = new Provider(this, "provider", {
        onEventHandler: updateMediaTailorConfigLambda
    });

    this.serviceToken = this.provider.serviceToken

    const resource = new CustomResource(this, 'Resource', {
      serviceToken: this.provider.serviceToken,
      properties: props
    })

    resource.getAtt('Response').toString();
  }
}