/**
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
  aws_mediapackage as mediapackage, 
  aws_cloudfront as cloudfront,
  aws_cloudfront_origins as origins,
  aws_s3 as s3,
  CfnOutput,
  Fn} from "aws-cdk-lib";
import { Construct } from "constructs";
import { Secrets } from "./secrets_mediapackage";
import * as cdk from 'aws-cdk-lib';
import { NagSuppressions } from 'cdk-nag';

export class CloudFront extends Construct {

  //👇 Defining public variables to export on CloudFormation 
  public readonly channel: mediapackage.CfnChannel;
  public readonly hlsPlayback: string;
  public readonly dashPlayback: string;
  public readonly s3LogBucket: s3.Bucket;

  //Defining private Variable
  private readonly CDNHEADER="MediaPackageCDNIdentifier"
  private readonly DESCRIPTIONDISTRIBUTION = " - CDK deployment Live Streaming Distribution";


  constructor(scope: Construct, id: string, hlsEndpoint: string, dashEndpoint: string, props: Secrets){
    super(scope, id);

    /*
    * First step: Create S3 bucket for logs 👇
    */
    //👇 1. Creating S3 Buckets for logs and demo website
    const s3Logs = new s3.Bucket(this, "LogsBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicPolicy: true,
        blockPublicAcls: true,
        ignorePublicAcls: true,
        restrictPublicBuckets: true
       }),
    });
    NagSuppressions.addResourceSuppressions(s3Logs, [
      {
        id: 'AwsSolutions-S1',
        reason: 'Remediated through property override.',
      },
    ]);
    
    /*
    * Second step: Create CloudFront Policies and Origins👇
    */
    //👇 2. Prepare for CloudFront distribution
    //2.1 Creating Origin Request Policies for MediaTailor & MediaPackage Origin
    const mediaPackageHostname = Fn.select(2, Fn.split("/", hlsEndpoint));

    const myOriginRequestPolicy = new cloudfront.OriginRequestPolicy(this, 'OriginRequestPolicy',
        {
          originRequestPolicyName: Aws.STACK_NAME + "Viewer-Country-City",
          comment: "Policy to FWD CloudFront headers",
          headerBehavior: cloudfront.OriginRequestHeaderBehavior.allowList(
            "CloudFront-Viewer-Address",
            "CloudFront-Viewer-Country",
            "CloudFront-Viewer-City",
            "Referer",
            "User-Agent",
            "Access-Control-Request-Method",
            "Access-Control-Request-Headers"
          ),
          queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.all(),
        }
      );


    const mediaPackageOrigin = new origins.HttpOrigin(
        mediaPackageHostname,
        {
          customHeaders: {
          'X-MediaPackage-CDNIdentifier': props.cdnSecret.secretValueFromJson(this.CDNHEADER).unsafeUnwrap().toString(),
          },
          originSslProtocols: [cloudfront.OriginSslPolicy.TLS_V1_2],
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
        }
    );



    /*
    * Third step: Create CloudFront Distributions 👇
    */
    //👇 3. Creating CloudFront distributions
 
    //3.1. Distribution for media Live distribution
    const distribution = new cloudfront.Distribution(this, "Distribution", {
        comment: Aws.STACK_NAME + this.DESCRIPTIONDISTRIBUTION,
        sslSupportMethod: cloudfront.SSLMethod.VIP,
        enableLogging: true,
        logBucket: s3Logs,
        logFilePrefix: "distribution-access-logs/",
        defaultRootObject: "",
        minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_1_2016,
        defaultBehavior: {
          origin: mediaPackageOrigin,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          originRequestPolicy : myOriginRequestPolicy,
          responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS_WITH_PREFLIGHT,
        },
        additionalBehaviors: {
          "*.m3u8": {
            origin: mediaPackageOrigin,
            viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
            originRequestPolicy : myOriginRequestPolicy,
            responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS_WITH_PREFLIGHT,
          },
          "*.ts": {
            origin: mediaPackageOrigin,
            viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
            originRequestPolicy : myOriginRequestPolicy,
            responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS_WITH_PREFLIGHT,
          },
          "*.mpd": {
            origin: mediaPackageOrigin,
            viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
            originRequestPolicy : myOriginRequestPolicy,
            responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS_WITH_PREFLIGHT,
          },
          "*.mp4": {
            origin: mediaPackageOrigin,
            viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
            originRequestPolicy : myOriginRequestPolicy,
            responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS_WITH_PREFLIGHT,
          }
        },
      });
      NagSuppressions.addResourceSuppressions(distribution, [
        {
          id: ' AwsSolutions-CFR4',
          reason: 'Remediated through property override.',
        },
      ]);
    /*
    * Final step: Exporting Varibales for Cfn Outputs 👇
    */
    this.s3LogBucket=s3Logs;

    //👇 Getting the path from EMP (/out/v1/<hashed-id-EMP>) endpoint
    const hlsPathEMP = Fn.select(1, Fn.split("/out/", hlsEndpoint));
    const dashPathEMP = Fn.select(1, Fn.split("/out/", dashEndpoint));
    
    this.hlsPlayback="https://" + distribution.domainName + '/out/' + hlsPathEMP
    this.dashPlayback="https://" + distribution.domainName + '/out/' + dashPathEMP


  }
}



