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
  aws_mediapackage as mediapackage, 
  aws_cloudfront as cloudfront,
  aws_cloudfront_origins as origins,
  aws_s3 as s3,
  CfnOutput,
  Duration,
  Fn} from "aws-cdk-lib";
import { Construct } from "constructs";
import { Secrets } from "./mediapackage_secrets"
import * as cdk from 'aws-cdk-lib';
import { NagSuppressions } from 'cdk-nag';

export class CloudFront extends Construct {

  //👇 Defining variables 
  public readonly channel: mediapackage.CfnChannel;
  public readonly hlsPlayback: string;
  public readonly dashPlayback: string;
  public readonly cmafPlayback: string;
  private readonly CDNHEADER="MediaPackageCDNIdentifier"
  private readonly DESCRIPTIONDISTRIBUTION = " - CDK deployment Live Streaming Distribution";

  constructor(scope: Construct, id: string, hlsEndpoint: string, dashEndpoint: string, cmafEndpoint: string, props: Secrets){
    super(scope, id);

    /*
    * First step: Create S3 bucket for logs 👇
    */
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

    /*
    * Second step: Create CloudFront Policies and Origins👇
    */
    // Extract MediaPackage Hostname from the HLS endpoint 👇
    const mediaPackageHostname = Fn.select(2, Fn.split("/", hlsEndpoint));

    // Creating a custom origin request policy  👇
    const myOriginRequestPolicy = new cloudfront.OriginRequestPolicy(this, 'OriginRequestPolicy',
        {
          originRequestPolicyName: Aws.STACK_NAME + "-OriginRequestPolicy",
          comment: "Policy to FWD headers to the origin",
          headerBehavior: cloudfront.OriginRequestHeaderBehavior.allowList(
            "Referer",
            "User-Agent",
            "Access-Control-Request-Method",
            "Access-Control-Request-Headers"
          ),
          queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.all(),
        }
      );
    // Creating a custom cache policy for MediaPackage 👇
    const myCachePolicyEMP = new cloudfront.CachePolicy(this, 'CachePolicyEMP',
      {
        cachePolicyName: Aws.STACK_NAME + "-CachePolicyEMP",
        comment: "Policy for Elemental MediaPackage Origin",
        defaultTtl: Duration.seconds(86400),
        minTtl: Duration.seconds(0),
        maxTtl: Duration.seconds(31536000),
        cookieBehavior: cloudfront.CacheCookieBehavior.none(),
        headerBehavior: cloudfront.CacheHeaderBehavior.allowList('origin'),
        queryStringBehavior: cloudfront.CacheQueryStringBehavior.allowList('aws.manifestfilter','m','start','end'),
        enableAcceptEncodingGzip: true,
        enableAcceptEncodingBrotli: false,
      }
    );

    // Creating a custom response headers policy 👇
    const myResponseHeadersPolicy = new cloudfront.ResponseHeadersPolicy(this, 'ResponseHeadersPolicy', {
      responseHeadersPolicyName: Aws.STACK_NAME + "-ResponsePolicy",
      comment: 'ResponseHeaders Policy for CORS',
      corsBehavior: {
        accessControlAllowCredentials: false,
        accessControlAllowHeaders: ['*'],
        accessControlAllowMethods: ['GET', 'HEAD', 'OPTIONS'],
        accessControlAllowOrigins: ['*'],
        accessControlMaxAge: Duration.seconds(600),
        originOverride: true,
      }
    });

    // Creating origin for MediaPackage 👇
    const mediaPackageOrigin = new origins.HttpOrigin(
        mediaPackageHostname,
        {
          customHeaders: {
          'X-MediaPackage-CDNIdentifier': props.cdnSecret.secretValueFromJson(this.CDNHEADER).unsafeUnwrap().toString(),
          },
          originSslProtocols: [cloudfront.OriginSslPolicy.TLS_V1_2],
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
          originShieldRegion: "",
          connectionAttempts:2,
          connectionTimeout:Duration.seconds(5)
        }
    );



    /*
    * Third step: Create CloudFront Distributions 👇
    */
    // Creating errorResponse 👇
    const errorResponse= [
      {
        httpStatus: 400,
        ttl: Duration.seconds(1),
      },
      {
        httpStatus: 403,
        ttl: Duration.seconds(1),
      },
      {
        httpStatus: 404,
        ttl: Duration.seconds(1),
      },
      {
        httpStatus: 405,
        ttl: Duration.seconds(1),
      },
      {
        httpStatus: 414,
        ttl: Duration.seconds(1),
      },
      {
        httpStatus: 416,
        ttl: Duration.seconds(1),
      },
      {
        httpStatus: 500,
        ttl: Duration.seconds(1),
      },
      {
        httpStatus: 501,
        ttl: Duration.seconds(1),
      },
      {
        httpStatus: 502,
        ttl: Duration.seconds(1),
      },
      {
        httpStatus: 503,
        ttl: Duration.seconds(1),
      },
      {
        httpStatus: 504,
        ttl: Duration.seconds(1),
      }
    ];

    //3.1. Distribution for media Live distribution
    const distribution = new cloudfront.Distribution(this, "Distribution", {
        comment: Aws.STACK_NAME + this.DESCRIPTIONDISTRIBUTION,
        sslSupportMethod: cloudfront.SSLMethod.VIP,
        enableLogging: true,
        logBucket: s3Logs,
        logFilePrefix: "distribution-access-logs/",
        defaultRootObject: "",
        minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_1_2016,
        errorResponses: errorResponse,
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
            cachePolicy: myCachePolicyEMP,
            originRequestPolicy : myOriginRequestPolicy,
            responseHeadersPolicy: myResponseHeadersPolicy,
          },
          "*.ts": {
            origin: mediaPackageOrigin,
            viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            cachePolicy: myCachePolicyEMP,
            originRequestPolicy : myOriginRequestPolicy,
            responseHeadersPolicy: myResponseHeadersPolicy,
          },
          "*.mpd": {
            origin: mediaPackageOrigin,
            viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            cachePolicy: myCachePolicyEMP,
            originRequestPolicy : myOriginRequestPolicy,
            responseHeadersPolicy: myResponseHeadersPolicy,
          },
          "*.mp4": {
            origin: mediaPackageOrigin,
            viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            cachePolicy: myCachePolicyEMP,
            originRequestPolicy : myOriginRequestPolicy,
            responseHeadersPolicy: myResponseHeadersPolicy,
          }
        },
      });


    //👇 Getting the path from EMP (/out/v1/<hashed-id-EMP>) endpoint
    const hlsPathEMP = Fn.select(1, Fn.split("/out/", hlsEndpoint));
    const dashPathEMP = Fn.select(1, Fn.split("/out/", dashEndpoint));
    const cmafPathEMP = Fn.select(1, Fn.split("/out/", cmafEndpoint));
    
    
    this.hlsPlayback="https://" + distribution.domainName + '/out/' + hlsPathEMP
    this.dashPlayback="https://" + distribution.domainName + '/out/' + dashPathEMP
    this.cmafPlayback="https://" + distribution.domainName + '/out/' + cmafPathEMP

    /*
    * Final step: Exporting Varibales for Cfn Outputs 👇
    */

    new CfnOutput(this, "MyCloudFrontHlsEndpoint", {
      value: this.hlsPlayback,
      exportName: Aws.STACK_NAME + "cloudFrontHlsEndpoint",
      description: "The HLS playback endpoint",
    });
    new CfnOutput(this, "MyCloudFrontDashEndpoint", {
      value: this.dashPlayback,
      exportName: Aws.STACK_NAME + "cloudFrontDashEndpoint",
      description: "The MPEG DASH playback endpoint",
    });
    new CfnOutput(this, "MyCloudFrontCmafEndpoint", {
      value: this.cmafPlayback,
      exportName: Aws.STACK_NAME + "cloudFrontCmafEndpoint",
      description: "The CMAF playback endpoint",
    });
    // Exporting S3 Buckets for the Log and the hosting demo 
    new CfnOutput(this, "MyCloudFrontS3LogBucket", {
      value: s3Logs.bucketName,
      exportName: Aws.STACK_NAME + "cloudFrontS3BucketLog",
      description: "The S3 bucket for CloudFront logs",
    });


    NagSuppressions.addResourceSuppressions(s3Logs, [
      {
        id: 'AwsSolutions-S1',
        reason: 'Remediated through property override.',
      },
    ]);

    NagSuppressions.addResourceSuppressions(distribution, [
      {
        id: ' AwsSolutions-CFR4',
        reason: 'Remediated through property override.',
      },
    ]);

  }
}


