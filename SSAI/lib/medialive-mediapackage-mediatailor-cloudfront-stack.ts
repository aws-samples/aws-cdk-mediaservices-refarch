import {
  CfnOutput,
  Fn,
  Aws
} from "aws-cdk-lib";
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { MediaPackageCdnAuth } from './mediapackage';
import { MediaLive } from './medialive';
import { MediaTailor } from './mediatailor';
import { CloudFront } from './cloudfront';
import { AutoStartMediaLive } from './custom_ressources/medialive-autostart';
import { UpdateDemoWebsite } from './custom_ressources/s3-update-config-file';
import { NagSuppressions } from 'cdk-nag';


export class MedialiveMediapackageMediaTailorCloudfrontStack extends cdk.Stack {
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
    * Third step: Create MediaTailor Configuration 👇
    */
    const mediaTailor = new MediaTailor(
      this, 
      "MyMediaTailorChannel",
      configuration.mediaTailor,
      mediaPackageChannel.myChannelEndpointHls.attrUrl
    );


    /*
    * Fourth step: Create CloudFront distributions for Distribution and Demo Website 👇
    */
    const cloudfront = new CloudFront(
      this,
      "MyCloudFrontDistribution", 
      mediaPackageChannel.myChannelEndpointHls.attrUrl,
      mediaPackageChannel.myChannelEndpointDash.attrUrl,
      mediaTailor.EMTEndPointSESSION,
      mediaPackageChannel.secret
    );


    //👇Add dependencyto wait for MediaPackage channel to be ready before deploying MediaLive & MediaTailor
    mediaLiveChannel.node.addDependency(mediaPackageChannel);
    mediaTailor.node.addDependency(mediaPackageChannel)

    /*
    * Final step: Generate Custom Ressource to update the config file for the DemoWebsite 👇
    */
    const resource = new UpdateDemoWebsite(this, 'DemoResource', {
      sessionURLHls: cloudfront.emtHlsSession,
      sessionURLDash: cloudfront.emtDashSession,
      s3Bucket: cloudfront.s3DemoBucket
    });


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
      NagSuppressions.addResourceSuppressions(
        resource,
        [
          {
            id: 'AwsSolutions-IAM4',
            reason: 'Remediated through property override.',
            appliesTo: ['Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'], 
          },
        ],
        true
      );
    }

    // Enable adding suppressions to child constructs
    NagSuppressions.addResourceSuppressions(
      this,
      [
        {
          id: 'AwsSolutions-IAM4',
          reason: 'Remediated through property override.',
          appliesTo: ['Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'], 
        },
      ],
      true
    );
    NagSuppressions.addResourceSuppressions(
      this,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'Remediated through property override.',
        },
      ],
      true
    );
  }
}
