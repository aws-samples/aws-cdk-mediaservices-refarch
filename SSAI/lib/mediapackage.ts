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
  Aws,
  aws_iam as iam,
  Duration,
  CfnOutput,
  aws_mediapackage as mediapackage } from "aws-cdk-lib";
import { Construct } from "constructs";
import { Secrets } from "./mediapackage_secrets";
import { CmafOutputValue } from "./custom_ressources/mediapackage-cmaf-output";
import { NagSuppressions } from 'cdk-nag';

interface MediaPackageParameterReaderProps {
  ad_markers:string,
  hls_segment_duration_seconds: number,
  hls_playlist_window_seconds: number,
  hls_max_video_bits_per_second: number,
  hls_min_video_bits_per_second: number,
  hls_stream_order: string,
  hls_include_I_frame:boolean,
  hls_audio_rendition_group: boolean,
  hls_program_date_interval:number,
  dash_period_triggers: string,
  dash_profile: string,
  dash_segment_duration_seconds: number,
  dash_segment_template: string,
  dash_manifest_window_seconds: number,
  dash_max_video_bits_per_second: number,
  dash_min_video_bits_per_second: number,
  dash_stream_order: string,
  cmaf_segment_duration_seconds: number,
  cmaf_include_I_frame:boolean,
  cmaf_program_date_interval:number,
  cmaf_max_video_bits_per_second: number,
  cmaf_min_video_bits_per_second: number,
  cmaf_stream_order: string,
  cmaf_playlist_window_seconds: number,
  mss_segment_duration_seconds: number,
  mss_manifest_window_seconds: number,
  mss_max_video_bits_per_second: number,
  mss_min_video_bits_per_second: number,
  mss_stream_order: string
}

export class MediaPackageCdnAuth extends Construct {
  public readonly myChannel: mediapackage.CfnChannel;
  public readonly myChannelEndpointHls: mediapackage.CfnOriginEndpoint;
  public readonly myChannelEndpointDash: mediapackage.CfnOriginEndpoint;
  public readonly myChannelEndpointCmaf: mediapackage.CfnOriginEndpoint;
  public readonly myChannelEndpointCmafUrl: string;
  
  
  public readonly secret: Secrets;
  public readonly myChannelName: string;
  

  constructor(scope: Construct, id: string, configuration: MediaPackageParameterReaderProps ){
    super(scope, id);
    const myMediaPackageChannelName=Aws.STACK_NAME + "_EMP-CDK"
    
    /*
    * First step: Preparing Secrets + IAM 👇
    */
    //👇 Creating Secrets for CDN authorization on MediaPackage using Secret Manager
    const secret = new Secrets(this, "Secrets");
    this.secret=secret;
    const adTrigger=['BREAK',
    'DISTRIBUTOR_ADVERTISEMENT',
    'DISTRIBUTOR_OVERLAY_PLACEMENT_OPPORTUNITY',
    'DISTRIBUTOR_PLACEMENT_OPPORTUNITY',
    'PROVIDER_ADVERTISEMENT',
    'PROVIDER_OVERLAY_PLACEMENT_OPPORTUNITY',
    'PROVIDER_PLACEMENT_OPPORTUNITY',
    'SPLICE_INSERT']

    //👇 Create Custom Policy for CDN Authorization
    const customPolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          resources: [
            secret.cdnSecret.secretArn,
          ],
          actions: [
            "secretsmanager:GetSecretValue",
            "secretsmanager:DescribeSecret",
            "secretsmanager:ListSecrets",
            "secretsmanager:ListSecretVersionIds",
          ],
        }),
      ],
    });

    //👇 Create Role to be assumed by MediaPackage
    const role4mediapackage = new iam.Role(this, "MyMediaPackageRole", {
      description: "A role to be assumed by MediaPackage",
      assumedBy: new iam.ServicePrincipal('mediapackage.amazonaws.com'),
      inlinePolicies: {
        policy: customPolicy,
      },
      maxSessionDuration: Duration.hours(1),
    });

    /*
    * Second step: Creating MediaPackage Channel and Endpoints 👇
    */
    //👇 Creating EMP channel
    this.myChannel = new mediapackage.CfnChannel(this, "MyCfnChannel", {
      id: myMediaPackageChannelName,
      description: "Channel for " + Aws.STACK_NAME,
    });
    

    //👇 HLS Packaging & endpoint with CDN authorization
    const hlsPackage: mediapackage.CfnOriginEndpoint.HlsPackageProperty = { 
      adMarkers: configuration['ad_markers'],
      adTriggers: adTrigger,
      segmentDurationSeconds: configuration['hls_segment_duration_seconds'],
      programDateTimeIntervalSeconds: configuration['hls_program_date_interval'],
      playlistWindowSeconds: configuration['hls_playlist_window_seconds'],
      useAudioRenditionGroup:configuration['hls_audio_rendition_group'],
      includeIframeOnlyStream:configuration['hls_include_I_frame'],
      streamSelection: {
        minVideoBitsPerSecond: configuration['hls_min_video_bits_per_second'],
        maxVideoBitsPerSecond: configuration['hls_max_video_bits_per_second'],
        streamOrder: configuration['hls_stream_order'],
      },
    };
    const hlsEndpoint = new mediapackage.CfnOriginEndpoint(
      this,
      "HlsEndpoint",
      {
        channelId: this.myChannel.id,
        id: Aws.STACK_NAME + "-hls-" + this.myChannel.id,
        hlsPackage,
        // the properties below are optional
        authorization: {
          cdnIdentifierSecret: secret.cdnSecret.secretArn,
          secretsRoleArn: role4mediapackage.roleArn,
        },
      }
    );

    hlsEndpoint.node.addDependency(this.myChannel);

    //👇 DASH Packaging & endpoint with CDN authorization
     //👇 DASH Packaging & endpoint with CDN authorization
    const dashPackage: mediapackage.CfnOriginEndpoint.DashPackageProperty = {
      periodTriggers: [configuration['dash_period_triggers']],
      adTriggers: adTrigger,
      segmentDurationSeconds: configuration['dash_segment_duration_seconds'],
      segmentTemplateFormat: configuration['dash_segment_template'],
      profile: configuration['dash_profile'],
      minBufferTimeSeconds: 10,
      minUpdatePeriodSeconds: configuration['dash_segment_duration_seconds'],
      manifestWindowSeconds: configuration['dash_manifest_window_seconds'],
      streamSelection: {
        minVideoBitsPerSecond: configuration['dash_min_video_bits_per_second'],
        maxVideoBitsPerSecond: configuration['dash_max_video_bits_per_second'],
        streamOrder: configuration['dash_stream_order'],
      },
    };
    const dashEndpoint = new mediapackage.CfnOriginEndpoint(
      this,
      "DashEndpoint",
      {
        channelId: this.myChannel.id,
        id: Aws.STACK_NAME + "-dash-" + this.myChannel.id,
        dashPackage,
        // the properties below are optional
        authorization: {
          cdnIdentifierSecret: secret.cdnSecret.secretArn,
          secretsRoleArn: role4mediapackage.roleArn,
        },
      }
    );
    dashEndpoint.node.addDependency(this.myChannel);

    //👇 CMAF Packaging & endpoint with CDN authorization
    const cmafPackage: mediapackage.CfnOriginEndpoint.CmafPackageProperty = {

      hlsManifests: [{
        id: Aws.STACK_NAME + "-cmaf-" + this.myChannel.id,
        // the properties below are optional
        adMarkers: configuration['ad_markers'],
        adTriggers: adTrigger,
        includeIframeOnlyStream: configuration['cmaf_include_I_frame'],
        manifestName: 'index',
        playlistWindowSeconds: configuration['cmaf_playlist_window_seconds'],
        programDateTimeIntervalSeconds: configuration['cmaf_program_date_interval'],
        url: 'url',
      }],
      segmentDurationSeconds: configuration['cmaf_segment_duration_seconds'],
      segmentPrefix: 'cmaf',
      streamSelection: {
        minVideoBitsPerSecond: configuration['cmaf_min_video_bits_per_second'],
        maxVideoBitsPerSecond: configuration['cmaf_max_video_bits_per_second'],
        streamOrder: configuration['cmaf_stream_order'],
      },
    };
    const cmafEndpoint = new mediapackage.CfnOriginEndpoint(
      this,
      "cmafEndpoint",
      {
        channelId: this.myChannel.id,
        id: Aws.STACK_NAME + "-cmaf-" + this.myChannel.id,
        cmafPackage,
        // the properties below are optional
        authorization: {
          cdnIdentifierSecret: secret.cdnSecret.secretArn,
          secretsRoleArn: role4mediapackage.roleArn,
        },
      }
    );
    cmafEndpoint.node.addDependency(this.myChannel);
    // It is not possible to get the CMAF output URL direclty from the attrUrl. 
    // A custom ressource for CMAF Output is needed to get the CMAF URL  👇    
    const resource = new CmafOutputValue(this, 'CmafEndpoint', {
      "cmafEndpointId":cmafEndpoint.id,
    });
    // Enable adding suppressions to child constructs
    NagSuppressions.addResourceSuppressions(
      resource,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'Remediated through property override.',
        },
      ],
      true
    );

    /*
    * Final step: Exporting Varibales  👇
    */
    this.myChannelName=myMediaPackageChannelName;
    this.myChannelEndpointHls=hlsEndpoint;
    this.myChannelEndpointDash=dashEndpoint;
    this.myChannelEndpointCmaf=cmafEndpoint;
    this.myChannelEndpointCmafUrl=resource.myEndpointUrl
 
    new CfnOutput(this, "MyMediaPackageChannelName", {
      value: this.myChannelName,
      exportName: Aws.STACK_NAME + "mediaPackageName",
      description: "The name of the MediaPackage Channel",
    });
      
    new CfnOutput(this, "MyMediaPackageChannelRole", {
      value: role4mediapackage.roleArn,
      exportName: Aws.STACK_NAME + "mediaPackageRoleName",
      description: "The role of the MediaPackage Channel",
    });

    }
}