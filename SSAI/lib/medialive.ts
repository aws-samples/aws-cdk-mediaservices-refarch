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
  aws_medialive as medialive,
  aws_iam as iam,
  Aws,
  CfnOutput, 
  Fn
} from "aws-cdk-lib";
import { Construct } from "constructs";
import { NagSuppressions } from 'cdk-nag';

interface MediaLiveParameterReaderProps {
  "streamName": string,
  "channelClass" : string, 
  "inputType" : string,
  "sourceEndBehavior" : string,
  "codec": string,
  "encodingProfile" : string,
  "priLink": string,
  "secLink" : string,
  "inputCidr": string,
  "priUrl": string,
  "secUrl" : string,
  "priFlow" : string,
  "secFlow" : string 
}

export class MediaLive extends Construct {
  public readonly channelLive: medialive.CfnChannel;
  public readonly channelInput: medialive.CfnInput;

  constructor(scope: Construct, id: string, configuration: MediaLiveParameterReaderProps , mediaPackageChannelId: string) {
    super(scope, id);
    const myMediaLiveChannelName=Aws.STACK_NAME + "_EML-CDK"


    var destinationValue=[]
    var inputSettingsValue={}

        
    /*
    * First step: Create MediaLive Policy & Role 👇
    */

    //👇Generate Policy for MediaLive to access MediaPackage, MediaConnect, S3, MediaStore...
     const customPolicyMediaLive = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          resources: [
              '*'
          ],
          actions: [
            "s3:ListBucket",
            "s3:PutObject",
            "s3:GetObject",
            "s3:DeleteObject",
            "mediastore:ListContainers",
            "mediastore:PutObject",
            "mediastore:GetObject",
            "mediastore:DeleteObject",
            "mediastore:DescribeObject",
            "mediaconnect:ManagedDescribeFlow",
            "mediaconnect:ManagedAddOutput",
            "mediaconnect:ManagedRemoveOutput",
            "logs:CreateLogGroup",
            "logs:CreateLogStream",
            "logs:PutLogEvents",
            "logs:DescribeLogStreams",
            "logs:DescribeLogGroups",
            "mediaconnect:ManagedDescribeFlow",
            "mediaconnect:ManagedAddOutput",
            "mediaconnect:ManagedRemoveOutput",
            "ec2:describeSubnets",
            "ec2:describeNetworkInterfaces",
            "ec2:createNetworkInterface",
            "ec2:createNetworkInterfacePermission",
            "ec2:deleteNetworkInterface",
            "ec2:deleteNetworkInterfacePermission",
            "ec2:describeSecurityGroups",
            "mediapackage:DescribeChannel",
          ],
        }),
        
      ],
    });

    //👇Generate a Role for MediaLive to access MediaPackage and S3. You can modify the role to restrict to specific S3 buckets
    const role = new iam.Role(this, "MediaLiveAccessRole", {
      inlinePolicies:{
        policy: customPolicyMediaLive,
      },
      assumedBy: new iam.ServicePrincipal("medialive.amazonaws.com"),
    });

    /*
    * Second step: Create Security Groups 👇
    */
   //👇Generate Security Groups for RTP and RTMP (Push) inputs 
    const mediaLiveSG = new medialive.CfnInputSecurityGroup(
      this,
      "MediaLiveInputSecurityGroup",
      {
        whitelistRules: [
          {
            cidr: configuration['inputCidr'],
          },
        ],
      }
    );

    /*
    * Third step: Create Input and specific info based on the input types 👇
    */
    //👇 1. Create a MediaLive input
    const inputName = Aws.STACK_NAME + "_" + configuration['inputType'] + "_MediaLiveInput"
    var cfnInputProps: medialive.CfnInputProps = {
      name: '',
      roleArn: '',
      type: '',
      inputSecurityGroups: [],
      destinations: [{
        streamName: '',
      }],
      inputDevices: [{
        id: '',
      }],
      mediaConnectFlows: [{
        flowArn: '',
      }],
      sources: [{
        passwordParam: 'passwordParam',
        url: 'url',
        username: 'username',
      }],
      vpc: {
        securityGroupIds: [''],
        subnetIds: [''],
      },
    };
    

    //👇1.1 Testing the Input Type
    switch (configuration['inputType']) {
      case "INPUT_DEVICE":
        //👇 Validating if STANDARD or SINGLE_PIPELINE Channel to provide 1 or 2 InputDevice
        if (configuration['channelClass'] == "STANDARD") {
          destinationValue=[{id: configuration['priLink']},{id: configuration['secLink']}]
        }else{
          destinationValue=[{id: configuration['priLink']}]
        }
        cfnInputProps = {
          name: inputName,
          type: configuration['inputType'],
          inputDevices: destinationValue ,
        };
      break;

      case "RTP_PUSH":
        cfnInputProps = {
          name: inputName,
          type: configuration['inputType'],
          inputSecurityGroups: [mediaLiveSG.ref],
        };
        break;
      case "RTMP_PUSH":
        //👇 Validating if STANDARD or SINGLE_PIPELINE Channel to provide 1 or 2 URL
        if (configuration['channelClass'] == "STANDARD") {
          destinationValue=[{streamName: configuration['streamName'] + "/primary"},{streamName: configuration['streamName'] + "/secondary"}]
        }else{
          destinationValue=[{streamName: configuration['streamName'] + "/primary"}]
        }
        cfnInputProps = {
          name: inputName,
          type: configuration['inputType'],
          inputSecurityGroups: [mediaLiveSG.ref],
          destinations: destinationValue,
        };
        break;
      case "MP4_FILE": case "RTMP_PULL": case "URL_PULL": case "TS_FILE":
        //👇 Validating if STANDARD or SINGLE_PIPELINE Channel to provide 1 or 2 URL
        if (configuration['channelClass'] == "STANDARD") {
          destinationValue=[{url: configuration['priUrl']},{url: configuration['secUrl']}]
        }else{
          destinationValue=[{url: configuration['priUrl']}]
        }
        cfnInputProps = {
          name: inputName,
          type: configuration['inputType'],
          sources: destinationValue,
        };
        inputSettingsValue={sourceEndBehavior: configuration['sourceEndBehavior']}
        break;
      case "MEDIACONNECT":
        //👇 Validating if STANDARD or SINGLE_PIPELINE Channel to provide 1 or 2 URL
        if (configuration['channelClass'] == "STANDARD") {
          destinationValue=[{flowArn: configuration['priFlow'],},{flowArn: configuration['secFlow'],}]
        }else{
          destinationValue=[{flowArn: configuration['priFlow'],}]
        }
        cfnInputProps = {
          name: inputName,
          type: configuration['inputType'],
          roleArn: role.roleArn,
          mediaConnectFlows: destinationValue,
        };
        break;
    }

    const mediaLiveInput = new medialive.CfnInput(this, "MediaInputChannel", cfnInputProps);

    //2. Create Channel
    var params = {
      resolution: "",
      maximumBitrate: "",
      encoderSettings: "",
    };

    switch (configuration['encodingProfile']) {
      case "HD-1080p":
        params.resolution = "HD";
        params.maximumBitrate = "MAX_20_MBPS";
        params.encoderSettings = require("../config/encoding-profiles/hd-1080p-30fps");
        break;
      case "HD-720p":
        params.resolution = "HD";
        params.maximumBitrate = "MAX_10_MBPS";
        params.encoderSettings = require("../config/encoding-profiles/hd-720p-25fps");
        break;
      case "SD-540p":
        params.resolution = "SD";
        params.maximumBitrate = "MAX_10_MBPS";
        params.encoderSettings = require("../config/encoding-profiles/sd-540p-30fps");
        break;
      default:
        throw new Error(
          `EncodingProfile is invalid or undefined: ${configuration['encodingProfile']}`
        );
    }

    const channelLive = new medialive.CfnChannel(this, "MediaLiveChannel", {
      channelClass: configuration['channelClass'],
      destinations: [
        {
          id: "media-destination",
          mediaPackageSettings: [
            {
              channelId: mediaPackageChannelId,
            },
          ],
        },
      ],
      inputSpecification: {
        codec: configuration.codec,
        resolution: params.resolution,
        maximumBitrate: params.maximumBitrate,
      },
      name: myMediaLiveChannelName,
      roleArn: role.roleArn,
      inputAttachments: [
        {
          inputId: mediaLiveInput.ref,
          inputAttachmentName: inputName,
          inputSettings: inputSettingsValue,
        },
      ],
      encoderSettings:
        params.encoderSettings as medialive.CfnChannel.EncoderSettingsProperty,
    });

    this.channelLive=channelLive;
    this.channelInput=mediaLiveInput
    /*
    * Final step: Exporting Varibales for Cfn Outputs 👇
    */
    new CfnOutput(this, "MyMediaLiveChannelArn", {
      value: this.channelLive.attrArn,
      exportName: Aws.STACK_NAME + "mediaLiveChannelArn",
      description: "The Arn of the MediaLive Channel",
    });
    new CfnOutput(this, "MyMediaLiveChannelInputName", {
      value: inputName,
      exportName: Aws.STACK_NAME + "mediaLiveChannelInputName",
      description: "The Input Name of the MediaLive Channel",
    });
    if (["UDP_PUSH", "RTP_PUSH", "RTMP_PUSH"].includes(configuration['inputType'])) {
      if (configuration['channelClass'] == "STANDARD"){
        new CfnOutput(this, "MyMediaLiveChannelDestPri", {
          value: Fn.join('', [ Fn.select(0, this.channelInput.attrDestinations) ] ),
          exportName: Aws.STACK_NAME + "mediaLiveChannelDestPri",
          description: "Primary MediaLive input Url",
        }); 
        new CfnOutput(this, "MyMediaLiveChannelDestSec", {
          value: Fn.join('', [ Fn.select(1, this.channelInput.attrDestinations) ] ),
          exportName: Aws.STACK_NAME + "mediaLiveChannelDestSec",
          description: "Seconday MediaLive input Url",
        });  
      }else{
        new CfnOutput(this, "MyMediaLiveChannelDestPri", {
          value: Fn.join('', [ Fn.select(0, this.channelInput.attrDestinations) ] ),
          exportName: Aws.STACK_NAME + "mediaLiveChannelDestPri",
          description: "Primary MediaLive input Url",
        }); 
      }
    }

    NagSuppressions.addResourceSuppressions(role, [
      {
        id: 'AwsSolutions-IAM5',
        reason: 'Remediated through property override.',
      },
    ]);

  }
}