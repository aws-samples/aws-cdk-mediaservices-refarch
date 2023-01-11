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
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { MediaPackageCdnAuth } from './mediapackage';
import { MediaLive } from './medialive';
import { CloudFront } from './cloudfront';
import { AutoStartMediaLive } from './custom_ressources/medialive-autostart';
import { NagSuppressions } from 'cdk-nag';


export class MedialiveMediapackageCloudfrontStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    /*
      * Getting configuration information 👇
    */
    var configuration = require("../config/configuration.json")



    /*
      * First step: Create MediaPackage Channel 👇
    */
    const mediaPackageChannel = new MediaPackageCdnAuth(
      this,
      "MyMediaPackageChannel",
      configuration.mediaPackage
    );

    /*
    * Second step: Create MediaLive Channel 👇
    */
    const mediaLiveChannel = new MediaLive(
      this,
      "MyMediaLiveChannel",
      configuration.mediaLive,
      mediaPackageChannel.myChannel.id
    );

    /*
    * Third step: Create CloudFront Distribution 👇
    */
    const cloudfront = new CloudFront(
      this,
      "MyCloudFrontDistribution", 
      mediaPackageChannel.myChannelEndpointHls.attrUrl,
      mediaPackageChannel.myChannelEndpointDash.attrUrl,
      mediaPackageChannel.myChannelEndpointCmafUrl,
      mediaPackageChannel.secret
    );


    //👇Add dependencyto wait for MediaPackage channel to be ready before deploying MediaLive
    mediaLiveChannel.node.addDependency(mediaPackageChannel);

    //👇Check if AutoStart is enabled in the MediaLive configuration to start MediaLive
    if (configuration.mediaLive["autoStart"]){
      const resource = new AutoStartMediaLive(this, 'AutoStartResource', {
        "mediaLiveChannel":mediaLiveChannel.channelLive.attrArn,
      });

      // Enable adding suppressions to child constructs
      NagSuppressions.addResourceSuppressions(
        resource,
        [
          {
            id: 'AwsSolutions-IAM5',
            reason: 'Remediated through property override.',
            appliesTo: ['Resource::*'], 
          },
        ],
        true
      );
      NagSuppressions.addResourceSuppressions(
        resource,
        [
          {
            id: 'AwsSolutions-IAM5',
            reason: 'Remediated through property override.',
            appliesTo: ['Action::medialive:*'], 
          },
        ],
        true
      );
    }
  }
}
