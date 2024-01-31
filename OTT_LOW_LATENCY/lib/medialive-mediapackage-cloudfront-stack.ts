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
import { Aws, CfnOutput, Fn } from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { MediaPackageV2 } from "./mediapackagev2";
import { MediaLive } from "./medialive";
import { CloudFront } from "./cloudfront";
import { AutoStartMediaLive } from "./custom_ressources/medialive-autostart";
import { NagSuppressions } from "cdk-nag";

export class MedialiveMediapackageCloudfrontStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    /*
     * Getting configuration information 👇
     */
    var configuration = require("../config/configuration.json");

    /*
     * First step: Create MediaPackage Channel 👇
     */
    const mediaPackageChannel = new MediaPackageV2(
      this,
      "MyMediaPackageChannel",
      configuration.mediaPackage,
    );

    /*
     * Second step: Create MediaLive Channel 👇
     */
    const mediaLiveChannel = new MediaLive(
      this,
      "MyMediaLiveChannel",
      configuration.mediaLive,
      "",
      mediaPackageChannel.myChannelIngestEndpoint1,
      mediaPackageChannel.myChannelIngestEndpoint2,
    );

    // MediaLive needed to create the an IAM role before it could be included in the
    // MediaPackage channel policy.
    mediaPackageChannel.attachChannelPolicy(mediaLiveChannel.roleArn);

    /*
     * Third step: Create CloudFront Distribution 👇
     */
    // Extract MediaPackage Hostname from the HLS endpoint
    const mediaPackageHostname = Fn.select(
      2,
      Fn.split("/", mediaPackageChannel.myChannelEndpointHlsUrl),
    );
    const s3LoggingEnabled = configuration.cloudFront.s3LoggingEnabled;
    const cloudfront = new CloudFront(
      this,
      "MyCloudFrontDistribution",
      mediaPackageHostname,
      s3LoggingEnabled,
    );

    /*
     * Final step: Exporting Varibales for Cfn Outputs
     */
    // Export MediaPackage Channel Name
    new CfnOutput(this, "MyMediaPackageChannelName", {
      value: mediaPackageChannel.myChannelName,
      exportName: Aws.STACK_NAME + "mediaPackageName",
      description: "The name of the MediaPackage Channel",
    });

    // Export playback URLs
    const hlsPathEMP = Fn.select(
      1,
      Fn.split("/out/", mediaPackageChannel.myChannelEndpointHlsUrl),
    );
    new CfnOutput(this, "MyHlsPlaybackUrl", {
      exportName: "MyHlsPlaybackUrl",
      description: "HLS playback endpoint on the CloudFront Distribution",
      value:
        "https://" + cloudfront.distribution.domainName + "/out/" + hlsPathEMP,
    });
    const llHlsPathEMP = Fn.select(
      1,
      Fn.split("/out/", mediaPackageChannel.myChannelEndpointLlHlsUrl),
    );
    new CfnOutput(this, "MyLlHlsPlaybackUrl", {
      exportName: "MyLlHlsPlaybackUrl",
      description:
        "Low Latency HLS playback endpoint on the CloudFront Distribution",
      value:
        "https://" +
        cloudfront.distribution.domainName +
        "/out/" +
        llHlsPathEMP,
    });
    const cmafPathEMP = Fn.select(
      1,
      Fn.split("/out/", mediaPackageChannel.myChannelEndpointCmafUrl),
    );
    new CfnOutput(this, "MyCmafPlaybackUrl", {
      exportName: "MyCmafPlaybackUrl",
      description: "CMAF playback endpoint on the CloudFront Distribution",
      value:
        "https://" + cloudfront.distribution.domainName + "/out/" + cmafPathEMP,
    });
    const llCmafPathEMP = Fn.select(
      1,
      Fn.split("/out/", mediaPackageChannel.myChannelEndpointLlCmafUrl),
    );
    new CfnOutput(this, "MyLlCmafPlaybackUrl", {
      exportName: "MyLlCmafPlaybackUrl",
      description:
        "Low Latency CMAF playback endpoint on the CloudFront Distribution",
      value:
        "https://" +
        cloudfront.distribution.domainName +
        "/out/" +
        llCmafPathEMP,
    });

    // Exporting S3 Buckets for CloudFront Logs
    if ( s3LoggingEnabled ) {
      new CfnOutput(this, "MyCloudFrontS3LogBucket", {
        value: cloudfront.s3LogsBucket.bucketName,
        exportName: Aws.STACK_NAME + "cloudFrontS3BucketLog",
        description: "The S3 bucket for CloudFront logs",
      });
    }

    //👇Check if AutoStart is enabled in the MediaLive configuration to start MediaLive
    if (configuration.mediaLive["autoStart"]) {
      const resource = new AutoStartMediaLive(this, "AutoStartResource", {
        mediaLiveChannel: mediaLiveChannel.channelLive.attrArn,
      });

      // Enable adding suppressions to child constructs
      NagSuppressions.addResourceSuppressions(
        resource,
        [
          {
            id: "AwsSolutions-IAM5",
            reason: "Remediated through property override.",
            appliesTo: ["Resource::*"],
          },
        ],
        true,
      );
      NagSuppressions.addResourceSuppressions(
        resource,
        [
          {
            id: "AwsSolutions-IAM5",
            reason: "Remediated through property override.",
            appliesTo: ["Action::medialive:*"],
          },
        ],
        true,
      );
    }

    NagSuppressions.addResourceSuppressionsByPath(
      this,
      "/MedialiveMediapackageCloudfrontStack/MyMediaPackageChannel/ExtraAttributes/extraAttribEMPLambda/ServiceRole/Resource",
      [
        {
          id: "AwsSolutions-IAM4",
          reason: "CDK managed resource",
          appliesTo: [
            "Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
          ],
        },
      ],
    );

    NagSuppressions.addResourceSuppressionsByPath(
      this,
      "/MedialiveMediapackageCloudfrontStack/AutoStartResource/autostartEMLLambda/ServiceRole/Resource",
      [
        {
          id: "AwsSolutions-IAM4",
          reason: "CDK managed resource",
          appliesTo: [
            "Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
          ],
        },
      ],
    );

    NagSuppressions.addResourceSuppressionsByPath(
      this,
      "/MedialiveMediapackageCloudfrontStack/AWS679f53fac002430cb0da5b7982bd2287/ServiceRole/Resource",
      [
        {
          id: "AwsSolutions-IAM4",
          reason: "CDK managed resource",
          appliesTo: [
            "Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
          ],
        },
      ],
    );

    NagSuppressions.addResourceSuppressionsByPath(
      this,
      "/MedialiveMediapackageCloudfrontStack/AWS679f53fac002430cb0da5b7982bd2287/Resource",
      [
        {
          id: "AwsSolutions-L1",
          reason:
            "This is a false alarm caused by a bug in the nag library. Lambda is running latest available Python 3.11.",
        },
      ],
    );

    if ( ! s3LoggingEnabled ) {
      NagSuppressions.addResourceSuppressionsByPath(
        this,
        "/MedialiveMediapackageCloudfrontStack/MyCloudFrontDistribution/Distribution/Resource",
        [
          {
            id: "AwsSolutions-CFR3",
            reason: "Not all regions support CloudFront distribution access logs so enabling logs has been made optional",
          },
        ],
      );
    }

  }
}
