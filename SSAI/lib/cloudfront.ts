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
  aws_s3_deployment as s3deploy,
  CfnOutput,
  Duration,
  Fn} from "aws-cdk-lib";
import { Construct } from "constructs";
import { Secrets } from "./mediapackage_secrets";
import * as cdk from 'aws-cdk-lib';
import { NagSuppressions } from 'cdk-nag';

export class CloudFront extends Construct {

   //👇 Defining public variables
   public readonly emtHlsPlayback: string;
   public readonly emtDashPlayback: string;
   public readonly emtHlsSession: string;
   public readonly emtDashSession: string;
   public readonly s3DemoBucket: s3.Bucket;

   //Defining private Variable
   private readonly MEDIATAILORADSHOSTNAME=`ads.mediatailor.${Aws.REGION}.amazonaws.com`;
   private readonly CDNHEADER="MediaPackageCDNIdentifier";
   private readonly DEMOFOLDER = "demo_website";
   private readonly DESCRIPTIONDISTRIBUTION = " - CDK deployment using Live SSAI";
   private readonly DESCRIPTIONDISTRIBUTIONDEMO = " - Demo website for Secure Resilient Live Streaming";
 

  constructor(scope: Construct, id: string, hlsEndpoint: string, dashEndpoint: string, sessionEndpointEMT: string, props: Secrets){
    super(scope, id);

    /*
    * First step: Create S3 bucket for logs and demo hosting website 👇
    */
    // Creating S3 Bucket for logs 👇
    const s3Logs = new s3.Bucket(this, "LogsBucket", {
      objectOwnership: s3.ObjectOwnership.OBJECT_WRITER,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicPolicy: true,
        blockPublicAcls: true,
        ignorePublicAcls: true,
        restrictPublicBuckets: true
       }),
    });

    // Creating S3 Bucket for demo website 👇
    const s3hostingBucket = new s3.Bucket(this, "HostingBucket", {
      objectOwnership: s3.ObjectOwnership.OBJECT_WRITER,
      serverAccessLogsBucket: s3Logs,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicPolicy: true,
        blockPublicAcls: true,
        ignorePublicAcls: true,
        restrictPublicBuckets: true
        }),
    });

    //copying the source file to the S3 Bucket for demo website
    new s3deploy.BucketDeployment(this, "DeployWebsite", {
      sources: [s3deploy.Source.asset("resources/" + this.DEMOFOLDER)],
      destinationBucket: s3hostingBucket,
    });
    
    /*
    * Second step: Create CloudFront Policies and Origins👇
    */
    // Extract MediaPackage & MediaTailor Hostname from the HLS endpoint 👇
    const mediaPackageHostname = Fn.select(2, Fn.split("/", hlsEndpoint));
    const mediaTailorHostname = Fn.select(2, Fn.split("/", sessionEndpointEMT));

    // Creating a custom origin request policy for MediaTailor, forwarding Host Header 👇
    const myOriginRequestPolicyEMT = new cloudfront.OriginRequestPolicy(this, 'OriginRequestPolicyEMT', {
      originRequestPolicyName: Aws.STACK_NAME + 'EMT-Policy',
      comment: 'EMT Policy',
      cookieBehavior: cloudfront.OriginRequestCookieBehavior.none(),
      headerBehavior: cloudfront.OriginRequestHeaderBehavior.allowList('X-Forwarded-For',
      'CloudFront-Viewer-Country',
      'User-Agent',
      'Access-Control-Request-Headers',
      'Access-Control-Request-Method',
      'Host'),
      queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.allowList('aws.sessionId','m'),
    });

    // Creating a custom origin request policy for MediaPackage  👇
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
        headerBehavior: cloudfront.CacheHeaderBehavior.none(),
        queryStringBehavior: cloudfront.CacheQueryStringBehavior.allowList('aws.manifestfilter','m','start','end'),
        enableAcceptEncodingGzip: true,
        enableAcceptEncodingBrotli: false,
      }
    );

    // Creating a custom response headers policy for the Video Streaming Distribution 👇
    const myResponseHeadersPolicy = new cloudfront.ResponseHeadersPolicy(this, 'ResponseHeadersPolicy', {
      responseHeadersPolicyName: Aws.STACK_NAME + "-ResponsePolicy",
      comment: 'ResponseHeaders Policy for CORS',
      corsBehavior: {
        accessControlAllowCredentials: false,
        accessControlAllowHeaders: ['*'],
        accessControlAllowMethods: ['GET', 'HEAD', 'OPTIONS', 'POST'],
        accessControlAllowOrigins: ['*'],
        accessControlMaxAge: Duration.seconds(600),
        originOverride: true,
      }
    });

     // Creating a custom response headers policy for the Static Distribution 👇
    const myResponseHeadersPolicyWebsite = new cloudfront.ResponseHeadersPolicy(
      this,
      "ResponseHeadersPolicyWebsite",
      {
        responseHeadersPolicyName: Aws.STACK_NAME + "HostingPolicy",
        comment: "ResponseHeadersPolicy for Hosting Website",
        securityHeadersBehavior: {
            contentTypeOptions: { override: true },
          frameOptions: {
            frameOption: cloudfront.HeadersFrameOption.DENY,
            override: true,
          },
          referrerPolicy: {
            referrerPolicy: cloudfront.HeadersReferrerPolicy.ORIGIN,
            override: true,
          },
          strictTransportSecurity: {
            accessControlMaxAge: Duration.seconds(31536000),
            includeSubdomains: true,
            override: true,
          },
          xssProtection: { protection: true, modeBlock: true, override: true },
        },
      }
    );

    //Creating MediaTailor, MediaPackage, MediaTailor-Ads and S3 origin with green header to be sent to the MediaPackage origin
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
    const mediaTailorOrigin = new origins.HttpOrigin(
      mediaTailorHostname,
      {
          customHeaders: { 
          //👇 Header to provide for accessing MediaPackage origin
          'X-MediaPackage-CDNIdentifier': props.cdnSecret.secretValueFromJson(this.CDNHEADER).unsafeUnwrap().toString(),
          },
          originSslProtocols: [cloudfront.OriginSslPolicy.TLS_V1_2],
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
      }
    );
    const mediaTailorAdsOrigin = new origins.HttpOrigin(
      this.MEDIATAILORADSHOSTNAME
    );

    const s3origin = new origins.S3Origin(s3hostingBucket);
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
        enableLogging: true,
        logBucket: s3Logs,
        logFilePrefix: "distribution-access-logs/",
        defaultRootObject: "",
        minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2016,
        errorResponses: errorResponse,
        defaultBehavior: {
          origin: mediaTailorAdsOrigin,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          responseHeadersPolicy: myResponseHeadersPolicy,
        },
        additionalBehaviors: {
          "/v1/session/*": {
            origin: mediaTailorOrigin,
            viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
            cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
            originRequestPolicy : myOriginRequestPolicyEMT,
            responseHeadersPolicy: myResponseHeadersPolicy,
          },
          "/out/*": {
            origin: mediaPackageOrigin,
            cachePolicy: myCachePolicyEMP,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
            viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            originRequestPolicy : myOriginRequestPolicy,
            responseHeadersPolicy: myResponseHeadersPolicy,
          },
          "/v1/*": {
            origin: mediaTailorOrigin,
            viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
            originRequestPolicy : myOriginRequestPolicyEMT,
            responseHeadersPolicy: myResponseHeadersPolicy,
          }
        },
      });
  
      const distributionDemo = new cloudfront.Distribution(this, "DistributionDemo", {
        comment: Aws.STACK_NAME + this.DESCRIPTIONDISTRIBUTIONDEMO,
        defaultRootObject: "index.html",
        enableLogging: true,
        logBucket: s3Logs,
        logFilePrefix: "demo-access-logs/",
        minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2016,
        defaultBehavior: {
          origin: s3origin,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        },
        additionalBehaviors: {
          "/index.html": {
            origin: s3origin,
            responseHeadersPolicy: myResponseHeadersPolicyWebsite,
            viewerProtocolPolicy:
              cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          },
        },
      });



    /*
    * Final step: Exporting Varibales for Cfn Outputs 👇
    */
    this.s3DemoBucket=s3hostingBucket;
    //👇 Getting the path from EMP (/out/v1/<hashed-id-EMP>) & EMT (/v1/master/<hashed-id-EMT>/<config-EMT>) endpoints
    const hlsPathEMP = Fn.select(1, Fn.split("/out/", hlsEndpoint));
    const dashPathEMP = Fn.select(1, Fn.split("/out/", dashEndpoint));
    const pathEMT = Fn.select(1, Fn.split("/v1/session/", sessionEndpointEMT));
    const sessionPathEMT = Fn.select(1, Fn.split("/v1/", sessionEndpointEMT));

    this.emtHlsPlayback="https://" + distribution.domainName + '/v1/master/' + pathEMT + 'out/' + hlsPathEMP
    this.emtDashPlayback="https://" + distribution.domainName + '/v1/dash/' + pathEMT + 'out/' + dashPathEMP
    this.emtHlsSession="https://" + distribution.domainName + '/v1/' + sessionPathEMT + 'out/' + hlsPathEMP
    this.emtDashSession="https://" + distribution.domainName + '/v1/' + sessionPathEMT + 'out/' + dashPathEMP
   
    new CfnOutput(this, "MyCloudFrontHlsEndpoint", {
      value: this.emtHlsPlayback,
      exportName: Aws.STACK_NAME + "cloudFrontHlsEndpoint",
      description: "The HLS playback endpoint",
    });
    new CfnOutput(this, "MyCloudFrontDashEndpoint", {
      value: this.emtDashPlayback,
      exportName: Aws.STACK_NAME + "cloudFrontDashEndpoint",
      description: "The MPEG DASH playback endpoint",
    });
    new CfnOutput(this, "MyCloudFrontDemoWebSiteEndpoint", {
      value: "https://"+distributionDemo.domainName,
      exportName: Aws.STACK_NAME + "cloudFrontDemoWebSiteEndpoint",
      description: "The demo web player to play the HLS and MPEG DASH",
    });

    new CfnOutput(this, "MyCloudFrontS3LogBucket", {
      value: s3Logs.bucketName,
      exportName: Aws.STACK_NAME + "cloudFrontS3BucketLog",
      description: "The S3 bucket for CloudFront logs",
    });
    new CfnOutput(this, "MyCloudFrontS3WebHostingDemoBucket", {
      value: s3hostingBucket.bucketName,
      exportName: Aws.STACK_NAME + "cloudFrontS3WebHostingDemoBucket",
      description: "The S3 bucket for the website hosting demo",
    });

    NagSuppressions.addResourceSuppressions(distribution, [
      {
        id: ' AwsSolutions-CFR4',
        reason: 'Remediated through property override.',
      },
    ]);
    NagSuppressions.addResourceSuppressions(distributionDemo, [
      {
        id: ' AwsSolutions-CFR4',
        reason: 'Remediated through property override.',
      },
    ]);
    NagSuppressions.addResourceSuppressions(s3Logs, [
      {
        id: 'AwsSolutions-S1',
        reason: 'Remediated through property override.',
      },
    ]);
    NagSuppressions.addResourceSuppressions(s3hostingBucket, [
      {
        id: 'AwsSolutions-S1',
        reason: 'Remediated through property override.',
      },
    ]);
  }
}