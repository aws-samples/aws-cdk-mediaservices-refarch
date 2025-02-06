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
  CfnOutput,
  Duration,
  Fn,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import { NagSuppressions } from "cdk-nag";
import { FunctionAssociation } from "aws-cdk-lib/aws-cloudfront";

const CONNECTION_ATTEMPTS = 2;
const MEDIATAILOR_ADS_HOSTNAME = `ads.mediatailor.${Aws.REGION}.amazonaws.com`;

export interface CloudFrontProps {
  foundationStackName: string;
  mediaTailorHostname: string;
  mediaPackageHostname: string;
  s3LoggingEnabled: boolean;
  logFilePrefix: string;
  nominalSegmentLength: number;
  enableIpv6: boolean;
  tokenizationFunctionArn?: string;
  keyGroupIds?: string[];
}

export class CloudFront extends Construct {
  // Defining variables
  public readonly distribution: cloudfront.Distribution;
  private readonly DESCRIPTIONDISTRIBUTION =
    " - CDK deployment Live Event Framework Distribution";

  constructor(scope: Construct, id: string, props: CloudFrontProps) {
    super(scope, id);

    const s3LoggingEnabled = props.s3LoggingEnabled;
    const nominalSegmentLength = props.nominalSegmentLength;
    const tokenizationFunctionArn = props.tokenizationFunctionArn;
    let keyGroupIdList = new Array<cloudfront.IKeyGroup>;

    /*
     * First step: Import CloudFront Policies and Origins from Foundation Stack
     */
    const foundation = this.importResourcesFromFoundationStack(props);

    /*
     * Second step: Create Origin Access Control to control access to MediaPackage origin
     */
    const mediaPackageOriginAccessControl =
      new cloudfront.CfnOriginAccessControl(
        this,
        "MediaPackageOriginAccessControl",
        {
          originAccessControlConfig: {
            name: Fn.join("-", [Aws.STACK_NAME, "MediaPackage", Aws.REGION]),
            originAccessControlOriginType: "mediapackagev2",
            signingBehavior: "always",
            signingProtocol: "sigv4",
          },
        },
      );

    /*
     * Third step: Create Origins for CloudFront Distribution
     */
    // Calculate optimal origin timeouts
    // Connection Timeout <= Segment Length
    const connectionTimeoutValue = Math.ceil(nominalSegmentLength / 2); // set half segment duration and round up

    // Segment length / 2 <= Read Timeout <= Segment Length
    const readTimeoutValue = Math.ceil(nominalSegmentLength / 2); // set half segment duration and round up

    // Keep-alive Timeout > Segment Length
    const keepaliveTimeoutValue = nominalSegmentLength + 1;

    // CloudFront Error Page TTLs = 1s
    const errorPageMinTtl = 1;

    // Create origin for MediaPackage
    const mediaPackageOrigin = new origins.HttpOrigin(
      props.mediaPackageHostname,
      {
        originId: "MediaPackage",
        originSslProtocols: [cloudfront.OriginSslPolicy.TLS_V1_2],
        protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
        originShieldEnabled: false,
        originShieldRegion: "",
        connectionAttempts: CONNECTION_ATTEMPTS,
        connectionTimeout: Duration.seconds(connectionTimeoutValue),
        readTimeout: Duration.seconds(readTimeoutValue),
        keepaliveTimeout: Duration.seconds(keepaliveTimeoutValue),
      },
    );

    // Create origin for MediaTailor
    const mediaTailorOrigin = new origins.HttpOrigin(
      props.mediaTailorHostname,
      {
        originId: "MediaTailor",
        originSslProtocols: [cloudfront.OriginSslPolicy.TLS_V1_2],
        protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
        originShieldEnabled: false,
        originShieldRegion: "",
        connectionAttempts: CONNECTION_ATTEMPTS,
        connectionTimeout: Duration.seconds(connectionTimeoutValue),
        readTimeout: Duration.seconds(readTimeoutValue),
        keepaliveTimeout: Duration.seconds(keepaliveTimeoutValue),
      },
    );

    // Create origin for delivery of MediaTailor Ads
    const mediaTailorAdsOrigin = new origins.HttpOrigin(
      MEDIATAILOR_ADS_HOSTNAME,
      {
        originId: "MediaTailorAds",
        originSslProtocols: [cloudfront.OriginSslPolicy.TLS_V1_2],
        protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
        originShieldEnabled: false,
        originShieldRegion: "",
        connectionAttempts: CONNECTION_ATTEMPTS,
        connectionTimeout: Duration.seconds(connectionTimeoutValue),
        readTimeout: Duration.seconds(readTimeoutValue),
        keepaliveTimeout: Duration.seconds(keepaliveTimeoutValue),
      },
    );

    // Setup association for Secure Media Delivery at the Edge CloudFront
    // Function if function ARN has been specified.
    const functionAssociations = Array<FunctionAssociation>();
    let pathPrefix = "";
    if (tokenizationFunctionArn) {
      // Set the path prefix to '*'
      // When the Secure Media Delivery at the Edge Tokenization solution is enabled on the
      // CloudFront Distribution the token will be the first component in all the requests
      // To ensure the path patterns still match the incoming requests with a token all the
      // path patterns will need to be prefixed with a '*'
      pathPrefix = "*";
      const secureMediaDeliveryFunctionName =
        tokenizationFunctionArn.split("/")[1];
      const cfFunction = cloudfront.Function.fromFunctionAttributes(
        this,
        "SecureMediaDeliveryCfFunction",
        {
          functionName: secureMediaDeliveryFunctionName,
          functionArn: tokenizationFunctionArn,
        },
      );

      const functionAssociation: cloudfront.FunctionAssociation = {
        eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
        function: cfFunction,
      };
      functionAssociations.push(functionAssociation);
    } else if ( props.keyGroupIds && props.keyGroupIds?.length >= 1 ) {

      // Load the list of CloudFront Key Groups
      props.keyGroupIds.forEach((keyGroupId) => {
        const keyGroup = cloudfront.KeyGroup.fromKeyGroupId(this, keyGroupId, keyGroupId);
        keyGroupIdList.push(keyGroup);
      });
  
    }

    //3.1. Distribution for Live stream delivery
    const distribution = new cloudfront.Distribution(this, "Distribution", {
      comment: Aws.STACK_NAME + this.DESCRIPTIONDISTRIBUTION,
      sslSupportMethod: cloudfront.SSLMethod.SNI,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      enableLogging: s3LoggingEnabled ? true : false,
      enableIpv6: props.enableIpv6,
      logBucket: s3LoggingEnabled ? foundation.s3LogsBucket : undefined,
      logFilePrefix: s3LoggingEnabled
        ? props.logFilePrefix + "/distribution-access-logs/"
        : undefined,
      defaultRootObject: "",
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_1_2016,
      errorResponses: this.getErrorResponseConfiguration(errorPageMinTtl),
      defaultBehavior: {
        origin: mediaTailorAdsOrigin,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        responseHeadersPolicy: foundation.defaultResponseHeadersPolicy,
        trustedKeyGroups: keyGroupIdList,
      },
      additionalBehaviors: {
        // MediaTailor Behaviours
        "/v1/session/*": {
          origin: mediaTailorOrigin,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          originRequestPolicy:
            foundation.mediaTailorManifestOriginRequestPolicy,
          responseHeadersPolicy: foundation.postResponseHeadersPolicy,
          trustedKeyGroups: keyGroupIdList,
        },
        [pathPrefix + "/v1/tracking/*"]: {
          origin: mediaTailorOrigin,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          originRequestPolicy:
            foundation.mediaTailorManifestOriginRequestPolicy,
          responseHeadersPolicy: foundation.postResponseHeadersPolicy,
          trustedKeyGroups: keyGroupIdList,
        },
        [pathPrefix + "/v1/w*"]: {
          origin: mediaTailorOrigin,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: foundation.mediaTailorAdCaptionsCachePolicy,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
          originRequestPolicy:
            foundation.mediaTailorAdCaptionsOriginRequestPolicy,
          responseHeadersPolicy: foundation.defaultResponseHeadersPolicy,
          functionAssociations: functionAssociations,
          trustedKeyGroups: keyGroupIdList,
        },
        [pathPrefix + "/v1/m*.m3u8"]: {
          origin: mediaTailorOrigin,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
          originRequestPolicy:
            foundation.mediaTailorManifestOriginRequestPolicy,
          responseHeadersPolicy: foundation.defaultResponseHeadersPolicy,
          functionAssociations: functionAssociations,
          trustedKeyGroups: keyGroupIdList,
        },
        [pathPrefix + "/v1/dash/*.mpd"]: {
          origin: mediaTailorOrigin,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
          originRequestPolicy:
            foundation.mediaTailorManifestOriginRequestPolicy,
          responseHeadersPolicy: foundation.defaultResponseHeadersPolicy,
          functionAssociations: functionAssociations,
          trustedKeyGroups: keyGroupIdList,
        },
        [pathPrefix + "/v1/segment/*"]: {
          origin: mediaTailorOrigin,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: foundation.mediaTailorAdRedirectCachePolicy,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
          originRequestPolicy:
            foundation.mediaTailorAdRedirectOriginRequestPolicy,
          responseHeadersPolicy: foundation.defaultResponseHeadersPolicy,
          functionAssociations: functionAssociations,
          trustedKeyGroups: keyGroupIdList,
        },
        [pathPrefix + "/v1/dashsegment/*"]: {
          origin: mediaTailorOrigin,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: foundation.mediaTailorAdRedirectCachePolicy,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
          originRequestPolicy:
            foundation.mediaTailorAdRedirectOriginRequestPolicy,
          responseHeadersPolicy: foundation.defaultResponseHeadersPolicy,
          functionAssociations: functionAssociations,
          trustedKeyGroups: keyGroupIdList,
        },
        // MediaPackage Behaviours
        [pathPrefix + "/out/v1/*.m3u8"]: {
          origin: mediaPackageOrigin,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: foundation.mediaPackageManifestCachePolicy,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
          originRequestPolicy:
            foundation.mediaPackageManifestOriginRequestPolicy,
          responseHeadersPolicy: foundation.defaultResponseHeadersPolicy,
          functionAssociations: functionAssociations,
          trustedKeyGroups: keyGroupIdList,
        },
        [pathPrefix + "/out/v1/*.mpd"]: {
          origin: mediaPackageOrigin,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: foundation.mediaPackageManifestCachePolicy,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
          originRequestPolicy:
            foundation.mediaPackageManifestOriginRequestPolicy,
          responseHeadersPolicy: foundation.defaultResponseHeadersPolicy,
          functionAssociations: functionAssociations,
          trustedKeyGroups: keyGroupIdList,
        },
        [pathPrefix + "/out/v1/*"]: {
          origin: mediaPackageOrigin,
          cachePolicy: foundation.mediaPackageMediaCachePolicy,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          originRequestPolicy: foundation.mediaPackageMediaOriginRequestPolicy,
          responseHeadersPolicy: foundation.defaultResponseHeadersPolicy,
          functionAssociations: functionAssociations,
          trustedKeyGroups: keyGroupIdList,
        },
      },
    });
    this.distribution = distribution;

    // Associate mediaPackageOriginAccessControl with the MediaPackage origin in the CloudFront
    // Dsitribution.
    // The Origin Access Control needs to be set with an override as CDK support for 'OriginAccessControlId'
    // has not yet been implemented.
    // Note in the below override the '2' value represents the index of the MediaPackage origin in the
    // CloudFormation yaml.
    const cfnDistribution = distribution.node
      .defaultChild as cloudfront.CfnDistribution;
    cfnDistribution.addOverride(
      "Properties.DistributionConfig.Origins.2.OriginAccessControlId",
      mediaPackageOriginAccessControl.ref,
    );

    new CfnOutput(this, "CloudFrontDistributionDomainName", {
      value: distribution.domainName,
      exportName: Aws.STACK_NAME + "-CloudFront-DomainName",
      description: "CloudFront domain name for channel group",
    });

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
        reason:
          "This distribution is only used for the delivery of media streams. " +
          "Not all media clients support the latest TLS. Relaxing this requirement for maximum compatibility.",
      },
    ]);
  }

  getErrorResponseConfiguration(errorPageMinTtl: number) {
    return [
      {
        httpStatus: 400,
        ttl: Duration.seconds(errorPageMinTtl),
      },
      {
        httpStatus: 403,
        ttl: Duration.seconds(errorPageMinTtl),
      },
      {
        httpStatus: 404,
        ttl: Duration.seconds(errorPageMinTtl),
      },
      {
        httpStatus: 405,
        ttl: Duration.seconds(errorPageMinTtl),
      },
      {
        httpStatus: 414,
        ttl: Duration.seconds(errorPageMinTtl),
      },
      {
        httpStatus: 416,
        ttl: Duration.seconds(errorPageMinTtl),
      },
      {
        httpStatus: 500,
        ttl: Duration.seconds(errorPageMinTtl),
      },
      {
        httpStatus: 501,
        ttl: Duration.seconds(errorPageMinTtl),
      },
      {
        httpStatus: 502,
        ttl: Duration.seconds(errorPageMinTtl),
      },
      {
        httpStatus: 503,
        ttl: Duration.seconds(errorPageMinTtl),
      },
      {
        httpStatus: 504,
        ttl: Duration.seconds(errorPageMinTtl),
      },
    ];
  }

  importResourcesFromFoundationStack(props: CloudFrontProps) {
    const foundationStackName = props.foundationStackName;

    // Load Foundation Stack S3 Log Bucket
    const cloudFrontLoggingBucket = props.s3LoggingEnabled
      ? Fn.importValue(foundationStackName + "-CloudFrontLoggingBucket")
      : undefined;
    const s3LogsBucket =
      props.s3LoggingEnabled && cloudFrontLoggingBucket
        ? s3.Bucket.fromBucketName(
            this,
            "CloudFrontLoggingBucket",
            cloudFrontLoggingBucket,
          )
        : undefined;

    // Load mediaTailorManifestOriginRequestPolicy created by foundation stack
    const mediaTailorManifestOriginRequestPolicyId = Fn.importValue(
      foundationStackName + "-MediaTailor-Manifest-OriginRequestPolicyId",
    );
    const mediaTailorManifestOriginRequestPolicy =
      cloudfront.OriginRequestPolicy.fromOriginRequestPolicyId(
        this,
        "MediaTailorManifestOriginRequestPolicy",
        mediaTailorManifestOriginRequestPolicyId,
      );

    // Load mediaTailorAdRedirectOriginRequestPolicy created by foundation stack
    const mediaTailorAdRedirectOriginRequestPolicyId = Fn.importValue(
      foundationStackName + "-MediaTailor-Ad-Redirect-OriginRequestPolicyId",
    );
    const mediaTailorAdRedirectOriginRequestPolicy =
      cloudfront.OriginRequestPolicy.fromOriginRequestPolicyId(
        this,
        "MediaTailorAdRedirectOriginRequestPolicy",
        mediaTailorAdRedirectOriginRequestPolicyId,
      );

    // Load mediaTailorAdRedirectCachePolicy created by foundation stack
    const mediaTailorAdRedirectCachePolicyId = Fn.importValue(
      foundationStackName + "-MediaTailor-Ad-Redirect-CachePolicyId",
    );
    const mediaTailorAdRedirectCachePolicy =
      cloudfront.CachePolicy.fromCachePolicyId(
        this,
        "MediaTailorAdRedirectCachePolicy",
        mediaTailorAdRedirectCachePolicyId,
      );

    // Load mediaTailorAdCaptionsOriginRequestPolicy created by foundation stack
    const mediaTailorAdCaptionsOriginRequestPolicyId = Fn.importValue(
      foundationStackName + "-MediaTailor-Ad-Captions-OriginRequestPolicyId",
    );
    const mediaTailorAdCaptionsOriginRequestPolicy =
      cloudfront.OriginRequestPolicy.fromOriginRequestPolicyId(
        this,
        "MediaTailorAdCaptionsOriginRequestPolicy",
        mediaTailorAdCaptionsOriginRequestPolicyId,
      );

    // Load mediaTailorAdCaptionsCachePolicy created by foundation stack
    const mediaTailorAdCaptionsCachePolicyId = Fn.importValue(
      foundationStackName + "-MediaTailor-Ad-Captions-CachePolicyId",
    );
    const mediaTailorAdCaptionsCachePolicy =
      cloudfront.CachePolicy.fromCachePolicyId(
        this,
        "MediaTailorAdCaptionsCachePolicy",
        mediaTailorAdCaptionsCachePolicyId,
      );

    // Load mediaPackageManifestOriginRequestPolicy created by foundation stack
    const mediaPackageManifestOriginRequestPolicyId = Fn.importValue(
      foundationStackName + "-MediaPackage-Manifest-OriginRequestPolicyId",
    );
    const mediaPackageManifestOriginRequestPolicy =
      cloudfront.OriginRequestPolicy.fromOriginRequestPolicyId(
        this,
        "MediaPackageManifestOriginRequestPolicy",
        mediaPackageManifestOriginRequestPolicyId,
      );

    // Load mediaPackageMediaOriginRequestPolicy created by foundation stack
    const mediaPackageMediaOriginRequestPolicyId = Fn.importValue(
      foundationStackName + "-MediaPackage-Media-OriginRequestPolicyId",
    );
    const mediaPackageMediaOriginRequestPolicy =
      cloudfront.OriginRequestPolicy.fromOriginRequestPolicyId(
        this,
        "MediaPackageMediaOriginRequestPolicy",
        mediaPackageMediaOriginRequestPolicyId,
      );

    // Load mediaPackageManifestCachePolicy created by foundation stack
    const mediaPackageManifestCachePolicyId = Fn.importValue(
      foundationStackName + "-MediaPackage-Manifest-CachePolicyId",
    );
    const mediaPackageManifestCachePolicy =
      cloudfront.CachePolicy.fromCachePolicyId(
        this,
        "MediaPackageManifestCachePolicy",
        mediaPackageManifestCachePolicyId,
      );

    // Load mediaPackageMediaCachePolicy created by foundation stack
    const mediaPackageMediaCachePolicyId = Fn.importValue(
      foundationStackName + "-MediaPackage-Media-CachePolicyId",
    );
    const mediaPackageMediaCachePolicy =
      cloudfront.CachePolicy.fromCachePolicyId(
        this,
        "MediaPackageMediaCachePolicy",
        mediaPackageMediaCachePolicyId,
      );

    // Load default responseHeadersPolicy created by foundation stack
    const defaultResponseHeadersPolicyId = Fn.importValue(
      foundationStackName + "-DefaultResponseHeadersPolicyId",
    );
    const defaultResponseHeadersPolicy =
      cloudfront.ResponseHeadersPolicy.fromResponseHeadersPolicyId(
        this,
        "DefaultResponseHeadersPolicy",
        defaultResponseHeadersPolicyId,
      );

    // Load post responseHeadersPolicy created by foundation stack
    const postResponseHeadersPolicyId = Fn.importValue(
      foundationStackName + "-PostResponseHeadersPolicyId",
    );
    const postResponseHeadersPolicy =
      cloudfront.ResponseHeadersPolicy.fromResponseHeadersPolicyId(
        this,
        "PostResponseHeadersPolicy",
        postResponseHeadersPolicyId,
      );

    return {
      mediaTailorManifestOriginRequestPolicy:
        mediaTailorManifestOriginRequestPolicy,
      mediaTailorAdRedirectOriginRequestPolicy:
        mediaTailorAdRedirectOriginRequestPolicy,
      mediaTailorAdCaptionsOriginRequestPolicy:
        mediaTailorAdCaptionsOriginRequestPolicy,
      mediaTailorAdRedirectCachePolicy:
        mediaTailorAdRedirectCachePolicy,
      mediaTailorAdCaptionsCachePolicy: mediaTailorAdCaptionsCachePolicy,
      mediaPackageManifestOriginRequestPolicy:
        mediaPackageManifestOriginRequestPolicy,
      mediaPackageMediaOriginRequestPolicy:
        mediaPackageMediaOriginRequestPolicy,
      mediaPackageManifestCachePolicy: mediaPackageManifestCachePolicy,
      mediaPackageMediaCachePolicy: mediaPackageMediaCachePolicy,
      defaultResponseHeadersPolicy: defaultResponseHeadersPolicy,
      postResponseHeadersPolicy: postResponseHeadersPolicy,
      s3LogsBucket: s3LogsBucket,
    };
  }
}
