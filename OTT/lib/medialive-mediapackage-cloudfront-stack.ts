import {
  CfnOutput,
  Fn,
  Aws
} from "aws-cdk-lib";
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { MediaPackageCdnAuth } from './media_package';
import { MediaLive } from './media_live';
import { CloudFront } from './cloudfront';


const configurationMediaLive = {
  "streamName": "live",
  "channelClass" : "STANDARD", 
  "inputType" : "URL_PULL",
  "sourceEndBehavior" : "LOOP",
  "codec": "AVC",
  "encodingProfile" : "HD-720p",
  "priLink": "",
  "secLink" : "",
  "inputCidr": "0.0.0.0/0" ,
  "priUrl": "https://d15an60oaeed9r.cloudfront.net/live_stream_v2/sports_reel_with_markers.m3u8",
  "secUrl" : "https://d15an60oaeed9r.cloudfront.net/live_stream_v2/sports_reel_with_markers.m3u8",
  "priFlow" : "",
  "secFlow" : "" 
}
const configurationMediaPackage = 
{
  "ad_markers":"PASSTHROUGH",
  "cdn_authorization":false,
  "hls_segment_duration_seconds": 4,
  "hls_playlist_window_seconds": 60,
  "hls_max_video_bits_per_second": 2147483647,
  "hls_min_video_bits_per_second": 0,
  "hls_stream_order": "ORIGINAL",
  "hls_include_I_frame":false,
  "hls_audio_rendition_group": false,
  "hls_program_date_interval":60,
  "dash_period_triggers": "ADS",
  "dash_profile": "NONE",
  "dash_segment_duration_seconds": 2,
  "dash_segment_template" : "TIME_WITH_TIMELINE",
  "dash_manifest_window_seconds": 60,
  "dash_max_video_bits_per_second": 2147483647,
  "dash_min_video_bits_per_second": 0,
  "dash_stream_order": "ORIGINAL",
  "cmaf_segment_duration_seconds": 4,
  "cmaf_include_I_frame":false,
  "cmaf_program_date_interval":60,
  "cmaf_max_video_bits_per_second": 2147483647,
  "cmaf_min_video_bits_per_second": 0,
  "cmaf_stream_order": "ORIGINAL",
  "cmaf_playlist_window_seconds": 60,
  "mss_segment_duration_seconds": 2,
  "mss_manifest_window_seconds": 60,
  "mss_max_video_bits_per_second": 2147483647,
  "mss_min_video_bits_per_second": 0,
  "mss_stream_order": "ORIGINAL"
}

export class MedialiveMediapackageCloudfrontStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    /*
      * First step: Create MediaPackage Channel 👇
    */
    const mediaPackageChannel = new MediaPackageCdnAuth(
      this,
      "MyMediaPackageChannel",
      configurationMediaPackage
    );

    /*
    * Second step: Create MediaLive Channel 👇
    */
    const mediaLiveChannel = new MediaLive(
      this,
      "MyMediaLiveChannel",
      configurationMediaLive,
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
      mediaPackageChannel.secret
    );


    //👇Add dependencyto wait for MediaPackage channel to be ready before deploying MediaLive
    mediaLiveChannel.node.addDependency(mediaPackageChannel);


    /*
    * Final step: CloudFormation Output 👇
    */
    // MediaLive 👇    
    new CfnOutput(this, "MyMediaLiveChannelArn", {
      value: mediaLiveChannel.myChannelArn,
      exportName: Aws.STACK_NAME + "mediaLiveChannelArn",
      description: "The Arn of the MediaLive Channel",
    });
    new CfnOutput(this, "MyMediaLiveChannelInputName", {
      value: mediaLiveChannel.myChannelInput,
      exportName: Aws.STACK_NAME + "mediaLiveChannelInputName",
      description: "The Input Name of the MediaLive Channel",
    });
    if (["UDP_PUSH", "RTP_PUSH", "RTMP_PUSH"].includes(configurationMediaLive['inputType'])) {
      if (configurationMediaLive['channelClass'] == "STANDARD"){
        new CfnOutput(this, "MyMediaLiveChannelDestPri", {
          value: Fn.join('', [ Fn.select(0, mediaLiveChannel.channelInput.attrDestinations) ] ),
          exportName: Aws.STACK_NAME + "mediaLiveChannelDestPri",
          description: "Primary MediaLive input Url",
        }); 
        new CfnOutput(this, "MyMediaLiveChannelDestSec", {
          value: Fn.join('', [ Fn.select(1, mediaLiveChannel.channelInput.attrDestinations) ] ),
          exportName: Aws.STACK_NAME + "mediaLiveChannelDestSec",
          description: "Seconday MediaLive input Url",
        });  
      }else{
        new CfnOutput(this, "MyMediaLiveChannelDestPri", {
          value: Fn.join('', [ Fn.select(0, mediaLiveChannel.channelInput.attrDestinations) ] ),
          exportName: Aws.STACK_NAME + "mediaLiveChannelDestPri",
          description: "Primary MediaLive input Url",
        }); 
      } 
    }


    // MediaPackage 👇    
    new CfnOutput(this, "MyMediaPackageChannelName", {
      value: mediaPackageChannel.myChannelName,
      exportName: Aws.STACK_NAME + "mediaPackageName",
      description: "The name of the MediaPackage Channel",
    });

    // CloudFront 👇    
    new CfnOutput(this, "MyCloudFrontHlsEndpoint", {
      value: cloudfront.hlsPlayback,
      exportName: Aws.STACK_NAME + "cloudFrontHlsEndpoint",
      description: "The HLS playback endpoint",
    });
    new CfnOutput(this, "MyCloudFrontDashEndpoint", {
      value: cloudfront.dashPlayback,
      exportName: Aws.STACK_NAME + "cloudFrontDashEndpoint",
      description: "The MPEG DASH playback endpoint",
    });
    // Exporting S3 Buckets for the Log and the hosting demo 
    new CfnOutput(this, "MyCloudFrontS3LogBucket", {
      value: cloudfront.s3LogBucket.bucketName,
      exportName: Aws.STACK_NAME + "cloudFrontS3BucketLog",
      description: "The S3 bucket for CloudFront logs",
    });
  }
}
