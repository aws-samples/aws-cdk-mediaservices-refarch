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
  aws_cloudfront as cloudfront,
  aws_cloudfront_origins as origins,
  aws_s3 as s3,
  Duration,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import { NagSuppressions } from "cdk-nag";

const ONE_YEAR_IN_SECONDS = 31536000;
const ONE_DAY_IN_SECONDS = 86400;

export class CloudFront extends Construct {
  // Defining variables
  public readonly distribution: cloudfront.Distribution;
  public readonly s3LogsBucket: s3.Bucket;
  private readonly DESCRIPTIONDISTRIBUTION =
    " - CDK deployment Live Streaming Distribution";

  private manifestQueryStrings = [
    "aws.manifestfilter",
    "start",
    "end",
    "_HLS_msn",
    "_HLS_part",
    "_HLS_skip",
  ];
  private mediaQueryStrings = ["m"];

  constructor(scope: Construct, id: string, mediaPackageHostname: string) {
    super(scope, id);

    /*
     * First step: Create S3 bucket for logs
     */
    const s3Logs = new s3.Bucket(this, "LogsBucket", {
      objectOwnership: s3.ObjectOwnership.OBJECT_WRITER,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicPolicy: true,
        blockPublicAcls: true,
        ignorePublicAcls: true,
        restrictPublicBuckets: true,
      }),
    });
    this.s3LogsBucket = s3Logs;

    /*
     * Second step: Create CloudFront Policies and Origins
     */
    // Creating a manifest custom origin request policy
    const myManifestOriginRequestPolicy = new cloudfront.OriginRequestPolicy(
      this,
      "ManifestOriginRequestPolicyEMP",
      {
        originRequestPolicyName:
          Aws.STACK_NAME + "-EMP-ManifestOriginRequestPolicy",
        comment:
          "Policy to FWD select query strings to the origin for manifest requests",
        headerBehavior: cloudfront.OriginRequestHeaderBehavior.none(),
        cookieBehavior: cloudfront.OriginRequestCookieBehavior.none(),
        queryStringBehavior:
          cloudfront.OriginRequestQueryStringBehavior.allowList(
            ...this.manifestQueryStrings,
          ),
      },
    );

    // Creating a manifest custom cache policy for MediaPackage
    const myManifestCachePolicy = new cloudfront.CachePolicy(
      this,
      "ManifestCachePolicyEMP",
      {
        cachePolicyName: Aws.STACK_NAME + "-EMP-ManifestCachePolicy",
        comment: "Policy for caching Elemental MediaPackage manifest requests",
        // MediaPackage includes max-age header on responses with a suggested cache value.
        // The max age will be >= 1 second and less than ONE_DAY_IN_SECONDS the content will be cached for the time
        // specified in the max-age header. For more information on this behaviour see:
        // https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Expiration.html#expiration-individual-objects
        defaultTtl: Duration.seconds(ONE_DAY_IN_SECONDS),
        minTtl: Duration.seconds(1),
        maxTtl: Duration.seconds(ONE_YEAR_IN_SECONDS),
        cookieBehavior: cloudfront.CacheCookieBehavior.none(),
        headerBehavior: cloudfront.CacheHeaderBehavior.none(),
        queryStringBehavior: cloudfront.CacheQueryStringBehavior.allowList(
          ...this.manifestQueryStrings,
        ),
        enableAcceptEncodingGzip: true,
        enableAcceptEncodingBrotli: false,
      },
    );

    // Creating a media custom origin request policy
    const myMediaOriginRequestPolicy = new cloudfront.OriginRequestPolicy(
      this,
      "MediaOriginRequestPolicyEMP",
      {
        originRequestPolicyName:
          Aws.STACK_NAME + "-EMP-MediaOriginRequestPolicy",
        comment:
          "Policy to FWD select query strings to the origin for media requests",
        headerBehavior: cloudfront.OriginRequestHeaderBehavior.none(),
        cookieBehavior: cloudfront.OriginRequestCookieBehavior.none(),
        queryStringBehavior:
          cloudfront.OriginRequestQueryStringBehavior.allowList(
            ...this.mediaQueryStrings,
          ),
      },
    );
    // Creating a media custom cache policy for MediaPackage
    const myMediaCachePolicy = new cloudfront.CachePolicy(
      this,
      "MediaCachePolicyEMP",
      {
        cachePolicyName: Aws.STACK_NAME + "-EMP-MediaCachePolicy",
        comment:
          "Policy for caching Elemental MediaPackage Origin media requests",
        // MediaPackage includes a max-age header of 14 days on media segment responses.
        // As the max age is larger than the minimum and less than the maximum TTL the content will expire
        // after the 14 day max-age if not evicted prior.
        // For more information on this behaviour see:
        // https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Expiration.html#expiration-individual-objects
        defaultTtl: Duration.seconds(ONE_DAY_IN_SECONDS),
        minTtl: Duration.seconds(1),
        maxTtl: Duration.seconds(ONE_YEAR_IN_SECONDS),
        cookieBehavior: cloudfront.CacheCookieBehavior.none(),
        headerBehavior: cloudfront.CacheHeaderBehavior.none(),
        queryStringBehavior: cloudfront.CacheQueryStringBehavior.allowList(
          ...this.mediaQueryStrings,
        ),
        enableAcceptEncodingGzip: true,
        enableAcceptEncodingBrotli: false,
      },
    );

    // Creating a custom response headers policy
    const myResponseHeadersPolicy = new cloudfront.ResponseHeadersPolicy(
      this,
      "ResponseHeadersPolicy",
      {
        responseHeadersPolicyName: Aws.STACK_NAME + "-ResponsePolicy",
        comment: "ResponseHeaders Policy for CORS",
        corsBehavior: {
          accessControlAllowCredentials: false,
          accessControlAllowHeaders: ["*"],
          accessControlAllowMethods: ["GET", "HEAD", "OPTIONS"],
          accessControlAllowOrigins: ["*"],
          accessControlMaxAge: Duration.seconds(600),
          originOverride: true,
        },
      },
    );

    // Creating origin for MediaPackage
    const mediaPackageOrigin = new origins.HttpOrigin(mediaPackageHostname, {
      originId: "MediaPackage",
      originSslProtocols: [cloudfront.OriginSslPolicy.TLS_V1_2],
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
      originShieldEnabled: false,
      originShieldRegion: "",

      connectionAttempts: 2, //Set the number of connection attempts and connection timeout to be between half a segment and segment duration
      connectionTimeout: Duration.seconds(3), // set half segment duration
      keepaliveTimeout: Duration.seconds(7), // set 1sec greater then segment length
      readTimeout: Duration.seconds(6), // set equal to segment length
    });

    /*
     * Third step: Create CloudFront Distributions
     */
    // Creating errorResponse
    const errorResponse = [
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
      },
    ];

    //3.1. Distribution for media Live distribution
    const distribution = new cloudfront.Distribution(this, "Distribution", {
      comment: Aws.STACK_NAME + this.DESCRIPTIONDISTRIBUTION,
      sslSupportMethod: cloudfront.SSLMethod.SNI,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      enableLogging: true,
      logBucket: s3Logs,
      logFilePrefix: "distribution-access-logs/",
      defaultRootObject: "",
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_1_2016,
      errorResponses: errorResponse,
      defaultBehavior: {
        origin: mediaPackageOrigin,
        cachePolicy: myMediaCachePolicy,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        originRequestPolicy: myMediaOriginRequestPolicy,
        responseHeadersPolicy: myResponseHeadersPolicy,
      },
      additionalBehaviors: {
        "*.m3u8": {
          origin: mediaPackageOrigin,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: myManifestCachePolicy,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
          originRequestPolicy: myManifestOriginRequestPolicy,
          responseHeadersPolicy: myResponseHeadersPolicy,
        },
      },
    });
    this.distribution = distribution;

    NagSuppressions.addResourceSuppressions(s3Logs, [
      {
        id: "AwsSolutions-S1",
        reason: "Remediated through property override.",
      },
    ]);

    NagSuppressions.addResourceSuppressions(distribution, [
      {
        id: "AwsSolutions-CFR1",
        reason: "Geo restrictions are not required for sample project.",
      },
    ]);

    NagSuppressions.addResourceSuppressions(distribution, [
      {
        id: "AwsSolutions-CFR2",
        reason: "WAF is not required for sample project.",
      },
    ]);

    NagSuppressions.addResourceSuppressions(distribution, [
      {
        id: "AwsSolutions-CFR4",
        reason: "Remediated through property override.",
      },
    ]);
  }
}
