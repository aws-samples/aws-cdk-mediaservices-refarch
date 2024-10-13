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
  aws_iam as iam,
  aws_kms as kms,
  aws_s3 as s3,
  aws_sns as sns,
  aws_sns_subscriptions as subscriptions,
  aws_events as events,
  aws_events_targets as targets,
  CfnOutput,
  Duration,
  triggers,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NagSuppressions } from "cdk-nag";
import { ICloudFrontConfig } from './foundationConfigInterface';

const ONE_YEAR_IN_SECONDS = 31536000;
const ONE_DAY_IN_SECONDS = 86400;

export interface FoundationProps {
  userEmail: string;
  config: ICloudFrontConfig;
}

export class Foundation extends Construct {
  private allowedMediaPackageManifestQueryStrings: string[] = [];
  private allowedMediaTailorManifestQueryStrings: string[] = [];

  constructor(scope: Construct, id: string, props: FoundationProps) {
    super(scope, id);

    this.allowedMediaPackageManifestQueryStrings =
      props.config.allowedMediaPackageManifestQueryStrings;
    this.allowedMediaTailorManifestQueryStrings =
      props.config.allowedMediaTailorManifestQueryStrings;

    // Create Sns Topic and subscribe passed in emails
    const snsTopicArn = this.createSnsTopicWithSubscription(props.userEmail);

    /*
     * Create S3 bucket for logs
     */
    this.createS3LoggingBucket(props.config.logging.logRetentionPeriod);

    /*
     * Create CloudFront MediaTailor Manifest Policies
     */
    this.createCloudFrontPolicies();

    /*
     * Create MediaTailor Logger Policy & Role
     * Execute trigger to create MediaTailorLogger role if it does not already exist in account
     * WARNING: The creation of this role will only be performed once and the role will NOT
     *          be removed when the stack is deleted.
     * For more information on this role see https://docs.aws.amazon.com/mediatailor/latest/ug/monitoring-permissions.html.
     */
    this.checkIfMediaTailorLoggerRoleExists();

    /*
     * Create MediaLive role and associated policies so MediaLive can access resources
     * required to receive content on inputs and push content to output destinations.
     */
    this.createMediaLiveRoleAndPolicies();

    /*
     * Create resources to send a daily notification containing a list of running MediaLive channels
     * deployed using Live Event Framework
     */
    this.createResourcesToSendDailyNotification( snsTopicArn );
  }

  // Method to create S3 Logging Bucket and associated resources for CloudFront Distribution
  createS3LoggingBucket(logRetentionPeriod: number) {
    const s3LogsBucket = new s3.Bucket(this, "LogsBucket", {
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

    // Set lifecycle policy to remove logs from S3 bucket after LOG_RETENTION_PERIOD_DAYS
    s3LogsBucket.addLifecycleRule({
      id: "DeleteLogsAfter" + logRetentionPeriod + "Days",
      enabled: true,
      expiration: Duration.days(logRetentionPeriod),
    });

    new CfnOutput(this, "CloudFrontLoggingBucket", {
      value: s3LogsBucket.bucketName,
      exportName: Aws.STACK_NAME + "-CloudFrontLoggingBucket",
      description: "CloudFront Logging Bucket",
    });

    NagSuppressions.addResourceSuppressions(s3LogsBucket, [
      {
        id: "AwsSolutions-S1",
        reason: "Remediated through property override.",
      },
    ]);

    return;
  }

  /**
   * Creates various CloudFront policies for handling different types of requests and responses.
   * These policies include:
   *
   * - Origin Request Policies for MediaTailor manifests and tracking requests
   * - Cache Policy for MediaTailor tracking requests
   * - Origin Request Policies for MediaPackage manifests and media segments
   * - Cache Policies for MediaPackage manifests and media segments
   *
   * The policies are configured to handle query strings, headers, and caching behavior
   * based on the specific requirements of each request type.
   */
  createCloudFrontPolicies() {
    /*
     * Create MediaTailor Manifest Policies
     */
    const mediaTailorManifestOriginRequestPolicy =
      new cloudfront.OriginRequestPolicy(
        this,
        "MediaTailorManifestOriginRequestPolicy",
        {
          originRequestPolicyName:
            Aws.STACK_NAME + "-EMT-ManifestOriginRequestPolicy",
          comment:
            "Policy to FWD select query strings and all headers to the origin for manifest requests",
          // Pass 'All viewer headers' to MediaTailor. This allows the 'Accept-Encoding' head to be passed
          // to MediaTailor and for compressed responses to be delivered when appropriate. This will reduce
          // the size of manifests returned to clients and minimise costs.
          headerBehavior: cloudfront.OriginRequestHeaderBehavior.all(),
          cookieBehavior: cloudfront.OriginRequestCookieBehavior.none(),
          queryStringBehavior:
            cloudfront.OriginRequestQueryStringBehavior.allowList(
              ...this.allowedMediaPackageManifestQueryStrings,
              ...this.allowedMediaTailorManifestQueryStrings,
            ),
        },
      );
    new CfnOutput(this, "MediaTailorManifestOriginRequestPolicyOutput", {
      value: mediaTailorManifestOriginRequestPolicy.originRequestPolicyId,
      exportName:
        Aws.STACK_NAME + "-MediaTailor-Manifest-OriginRequestPolicyId",
      description: "Origin Request Policy Id for MediaTailor Manifests",
    });

    /*
     * Create CloudFront MediaTailor Ad Segment Redirect Policies
     * These policies cache the 301 redirects to prevent duplicate beacons being sent back to providers.
     */
    const mediaTailorTrackingOriginRequestPolicy =
      new cloudfront.OriginRequestPolicy(
        this,
        "MediaTailorTrackingOriginRequestPolicy",
        {
          originRequestPolicyName:
            Aws.STACK_NAME + "-EMT-TrackingOriginRequestPolicy",
          comment:
            "Policy to FWD all query strings and headers to MediaTailor for tracking requests",
          // The format of a tracking request cannot be known in advance so 'All viewer headers' and 'All' query strings
          // are passed it MediaTailor.
          headerBehavior: cloudfront.OriginRequestHeaderBehavior.all(),
          cookieBehavior: cloudfront.OriginRequestCookieBehavior.none(),
          queryStringBehavior:
            cloudfront.OriginRequestQueryStringBehavior.all(),
        },
      );
    new CfnOutput(this, "MediaTailorTrackingOriginRequestPolicyOutput", {
      value: mediaTailorTrackingOriginRequestPolicy.originRequestPolicyId,
      exportName:
        Aws.STACK_NAME + "-MediaTailor-Tracking-OriginRequestPolicyId",
      description: "Origin Request Policy Id for MediaTailor Tracking requests",
    });

    // Creating a custom cache policy for MediaTailor Ad Segment Redirects
    const mediaTailorTrackingCachePolicy = new cloudfront.CachePolicy(
      this,
      "MediaTailorTrackingCachePolicy",
      {
        cachePolicyName: Aws.STACK_NAME + "-EMT-TrackingCachePolicy",
        comment: "Policy for caching Elemental MediaTailor tracking requests",
        defaultTtl: Duration.seconds(ONE_DAY_IN_SECONDS),
        minTtl: Duration.seconds(1),
        maxTtl: Duration.seconds(ONE_YEAR_IN_SECONDS),
        cookieBehavior: cloudfront.CacheCookieBehavior.none(),
        headerBehavior: cloudfront.CacheHeaderBehavior.none(),
        queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
        enableAcceptEncodingGzip: true,
        enableAcceptEncodingBrotli: true,
      },
    );
    new CfnOutput(this, "MediaTailorTrackingCachePolicyOutput", {
      value: mediaTailorTrackingCachePolicy.cachePolicyId,
      exportName: Aws.STACK_NAME + "-MediaTailor-Tracking-CachePolicyId",
      description: "Cache Policy Id for MediaTailor Tracking requests",
    });

    /*
     * Create CloudFront MediaPackage Manifest Policies
     */
    // Creating a custom origin request policy for MediaPackage manifests
    const mediaPackageManifestOriginRequestPolicy =
      new cloudfront.OriginRequestPolicy(
        this,
        "MediaPackageManifestOriginRequestPolicy",
        {
          originRequestPolicyName:
            Aws.STACK_NAME + "-EMP-ManifestOriginRequestPolicy",
          comment:
            "Policy to FWD select query strings to the origin for manifest requests",
          headerBehavior: cloudfront.OriginRequestHeaderBehavior.none(),
          cookieBehavior: cloudfront.OriginRequestCookieBehavior.none(),
          queryStringBehavior:
            cloudfront.OriginRequestQueryStringBehavior.allowList(
              ...this.allowedMediaPackageManifestQueryStrings,
            ),
        },
      );
    new CfnOutput(this, "MediaPackageManifestOriginRequestPolicyOutput", {
      value: mediaPackageManifestOriginRequestPolicy.originRequestPolicyId,
      exportName:
        Aws.STACK_NAME + "-MediaPackage-Manifest-OriginRequestPolicyId",
      description: "Origin Request Policy Id for MediaPackage Manifests",
    });

    // Creating a custom cache policy for MediaPackage manifests
    const mediaPackageManifestCachePolicy = new cloudfront.CachePolicy(
      this,
      "MediaPackageManifestCachePolicy",
      {
        cachePolicyName: Aws.STACK_NAME + "-EMP-ManifestCachePolicy",
        comment: "Policy for caching Elemental MediaPackage manifest requests",
        // MediaPackage includes max-age header on responses with a suggested cache value.
        // The max age will be >= 1 second and less than ONE_DAY_IN_SECONDS. The content will be cached for the time
        // specified in the max-age header. For more information on this behaviour see:
        // https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Expiration.html#expiration-individual-objects
        defaultTtl: Duration.seconds(ONE_DAY_IN_SECONDS),
        minTtl: Duration.seconds(1),
        maxTtl: Duration.seconds(ONE_YEAR_IN_SECONDS),
        cookieBehavior: cloudfront.CacheCookieBehavior.none(),
        headerBehavior: cloudfront.CacheHeaderBehavior.none(),
        queryStringBehavior: cloudfront.CacheQueryStringBehavior.allowList(
          ...this.allowedMediaPackageManifestQueryStrings,
        ),
        enableAcceptEncodingGzip: true,
        enableAcceptEncodingBrotli: true,
      },
    );
    new CfnOutput(this, "MediaPackageManifestCachePolicyOutput", {
      value: mediaPackageManifestCachePolicy.cachePolicyId,
      exportName: Aws.STACK_NAME + "-MediaPackage-Manifest-CachePolicyId",
      description: "Cache Policy Id for MediaPackage Manifests",
    });

    /*
     * Create CloudFront MediaPackage Media Segment Policies
     */
    // Creating a custom origin request policy for MediaPackage media segments
    const mediaPackageMediaOriginRequestPolicy =
      new cloudfront.OriginRequestPolicy(
        this,
        "MediaPackageMediaOriginRequestPolicy",
        {
          originRequestPolicyName:
            Aws.STACK_NAME + "-EMP-MediaOriginRequestPolicy",
          comment:
            "Policy to FWD no query or headers strings to the origin for media requests",
          headerBehavior: cloudfront.OriginRequestHeaderBehavior.none(),
          cookieBehavior: cloudfront.OriginRequestCookieBehavior.none(),
          queryStringBehavior:
            cloudfront.OriginRequestQueryStringBehavior.none(),
        },
      );
    new CfnOutput(this, "MediaPackageMediaOriginRequestPolicyOutput", {
      value: mediaPackageMediaOriginRequestPolicy.originRequestPolicyId,
      exportName: Aws.STACK_NAME + "-MediaPackage-Media-OriginRequestPolicyId",
      description: "Origin Request Policy Id for MediaPackage Media Segments",
    });

    // Creating a custom cache policy for MediaPackage media segments
    const mediaPackageMediaCachePolicy = new cloudfront.CachePolicy(
      this,
      "MediaPackageMediaCachePolicy",
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
        queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
        enableAcceptEncodingGzip: false,
        enableAcceptEncodingBrotli: false,
      },
    );
    new CfnOutput(this, "MediaPackageMediaCachePolicyOutput", {
      value: mediaPackageMediaCachePolicy.cachePolicyId,
      exportName: Aws.STACK_NAME + "-MediaPackage-Media-CachePolicyId",
      description: "Cache Policy Id for MediaPackage Media Segments",
    });

    // Creating a custom response headers policy for most of the behaviours
    const defaultResponseHeadersPolicy = new cloudfront.ResponseHeadersPolicy(
      this,
      "DefaultResponseHeadersPolicy",
      {
        responseHeadersPolicyName:
          Aws.STACK_NAME + "-DefaultResponseHeadersPolicy",
        comment: "ResponseHeaders Policy for HEAD, GET and OPTIONS CORS",
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
    new CfnOutput(this, "DefaultResponseHeadersPolicyOutput", {
      value: defaultResponseHeadersPolicy.responseHeadersPolicyId,
      exportName: Aws.STACK_NAME + "-DefaultResponseHeadersPolicyId",
      description:
        "Response header policy for head, get and options requests through distribution",
    });

    // Creating a custom response headers policy for post behaviours
    const postResponseHeadersPolicy = new cloudfront.ResponseHeadersPolicy(
      this,
      "PostResponseHeadersPolicy",
      {
        responseHeadersPolicyName:
          Aws.STACK_NAME + "-PostResponseHeadersPolicy",
        comment: "ResponseHeaders Policy for POST CORS",
        corsBehavior: {
          accessControlAllowCredentials: false,
          accessControlAllowHeaders: ["*"],
          accessControlAllowMethods: ["POST"],
          accessControlAllowOrigins: ["*"],
          accessControlMaxAge: Duration.seconds(600),
          originOverride: true,
        },
      },
    );
    new CfnOutput(this, "PostResponseHeadersPolicyOutput", {
      value: postResponseHeadersPolicy.responseHeadersPolicyId,
      exportName: Aws.STACK_NAME + "-PostResponseHeadersPolicyId",
      description:
        "Response header policy for post requests through distribution",
    });

    return;
  }

  // Function to verify SNS Topic deployed in foundation stack has at least 1 confirmed subscription
  // If role does not exist deployment will fail. Script in 'tools/mediatailor-logger-role/check_mediatailor_logger_role.py'
  // can be used to simplify creation of MediaTailorLogger role.
  // For more information on this role see https://docs.aws.amazon.com/mediatailor/latest/ug/monitoring-permissions.html.
  checkIfMediaTailorLoggerRoleExists() {
    // Create an IAM role for the Lambda function
    const lambdaRole = new iam.Role(this, "CheckMediaTailorLoggerLambdaRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      roleName: Aws.STACK_NAME + "-CheckMediaTailorLoggerLambdaRole",
      description:
        "Role for the CheckMediaTailorLoggerLambdaRole Lambda function",
    });

    // Create a custom policy statement for for creating role
    const iamPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "iam:CreateRole",
        "iam:GetRole",
        "iam:AttachRolePolicy",
        "iam:ListAttachedRolePolicies",
      ],
      resources: [`arn:aws:iam::${Aws.ACCOUNT_ID}:role/MediaTailorLogger`],
    });

    // Create a custom policy statement for CloudWatch permissions
    const cloudWatchPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
      ],
      resources: [`arn:aws:logs:${Aws.REGION}:${Aws.ACCOUNT_ID}:log-group`],
    });

    // Attach the custom policy statements to the IAM role
    lambdaRole.addToPolicy(cloudWatchPolicy);
    lambdaRole.addToPolicy(iamPolicy);

    // Run trigger to check MediaTailor Logger role exists
    const trigger = new triggers.TriggerFunction(
      this,
      "CheckMediaTailorLoggerRoleExists",
      {
        functionName: Aws.STACK_NAME + "-CheckMediaTailorLoggerRoleExists",
        runtime: lambda.Runtime.PYTHON_3_12,
        handler: "index.lambda_handler",
        code: lambda.Code.fromAsset(
          __dirname + "/../../lambda/check_mediatailor_logger_role",
        ),
        role: lambdaRole,
      },
    );

    NagSuppressions.addResourceSuppressions(lambdaRole, [
      {
        id: "AwsSolutions-IAM5",
        reason:
          "Resource is limited to log-groups in the account/region but a wildcard needs to " +
          "be specified at the end of the resources due to the full resource name being unpredictable.",
      },
    ]);

    return trigger;
  }

  /**
   * Creates an IAM role and policy for MediaLive to access various AWS services.
   *
   * The policy grants these permissions on all resources (*).
   *
   * An IAM role named "MediaLiveAccessRole" is created and associated with the policy.
   * The role is assumed by the medialive.amazonaws.com service principal.
   *
   * @returns void
   */
  createMediaLiveRoleAndPolicies() {
    // Generate Policy for MediaLive to access MediaPackage, MediaConnect, S3 ...
    // These permissions mirror the permissions of the MediaLiveAccessRole created by the console
    const customPolicyMediaLive = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          resources: ["*"],
          actions: [
            "s3:ListBucket",
            "s3:PutObject",
            "s3:GetObject",
            "s3:DeleteObject",
            "mediaconnect:ManagedDescribeFlow",
            "mediaconnect:ManagedAddOutput",
            "mediaconnect:ManagedRemoveOutput",
            "logs:CreateLogGroup",
            "logs:CreateLogStream",
            "logs:PutLogEvents",
            "logs:DescribeLogStreams",
            "logs:DescribeLogGroups",
            "ec2:describeSubnets",
            "ec2:describeNetworkInterfaces",
            "ec2:createNetworkInterface",
            "ec2:createNetworkInterfacePermission",
            "ec2:deleteNetworkInterface",
            "ec2:deleteNetworkInterfacePermission",
            "ec2:describeSecurityGroups",
            "mediapackage:DescribeChannel",
            "mediapackagev2:PutObject",
          ],
        }),
      ],
    });

    // Generate a Role for MediaLive to access MediaPackage and S3. You can modify the role to restrict to specific S3 buckets
    const role = new iam.Role(this, "MediaLiveAccessRole", {
      inlinePolicies: {
        policy: customPolicyMediaLive,
      },
      assumedBy: new iam.ServicePrincipal("medialive.amazonaws.com"),
    });

    new CfnOutput(this, "MediaLiveAccessRoleArn", {
      value: role.roleArn,
      exportName: Aws.STACK_NAME + "-MediaLiveAccessRoleArn",
      description: "MediaLive Access Role for MediaLive to use for events.",
    });

    NagSuppressions.addResourceSuppressions(role, [
      {
        id: "AwsSolutions-IAM5",
        reason: "Remediated through property override.",
      },
    ]);

    return;
  }

  // Function to create Event Bridge rule to invoke a lambda function at midnight UTC each night.
  // The lambda function will list all the running MediaLive channels with a 'LiveEventFrameworkVersion' tag.
  // The lambda will send a summary of the running channels to the SNS topic created in the foundation stack.
  createResourcesToSendDailyNotification(snsTopicArn: string) {

    // Create a Role for to send daily medialive notifications
    // Create an IAM role for the Lambda function
    const lambdaRole = new iam.Role(this, "DailyMediaLiveNotificationRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      roleName: Aws.STACK_NAME + "-DailyMediaLiveNotificationRole",
      description:
        "Role for the DailyMediaLiveNotificationRole Lambda function",
    });

    // Create a medialive policy statement querying 
    const medialivePolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "medialive:ListChannels",
        "medialive:DescribeChannel",
      ],
      resources: [
        `arn:aws:medialive:${Aws.REGION}:${Aws.ACCOUNT_ID}:channel:*`
      ],
    });

    // Create a sns policy statement publishing daily summary
    const snsPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [ "sns:Publish" ],
      resources: [ snsTopicArn ],
    });

    // Create a custom policy statement for CloudWatch permissions
    const cloudWatchPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
      ],
      resources: [`arn:aws:logs:${Aws.REGION}:${Aws.ACCOUNT_ID}:log-group`],
    });

    // Attach the custom policy statements to the IAM role
    lambdaRole.addToPolicy(cloudWatchPolicy);
    lambdaRole.addToPolicy(medialivePolicy);
    lambdaRole.addToPolicy(snsPolicy);

    NagSuppressions.addResourceSuppressions(lambdaRole, [
      {
        id: "AwsSolutions-IAM5",
        reason:
          "Resource is limited to log-groups in the account/region but a wildcard needs to " +
          "be specified at the end of the resources due to the full resource name being unpredictable. " +
          "Read-only permissions are granted to all MediaLive Channels in the account so the lambda " +
          "can check if they were deployed with LEF and are in a running state for notifications",
      },
    ], true );

    // Create a lambda function to invoke at midnight UTC each night
    const lambdaFunction = new lambda.Function(
      this,
      "DailyNotificationFunction",
      {
        functionName: Aws.STACK_NAME + "-DailyMediaLiveNotificationFunction",
        runtime: lambda.Runtime.PYTHON_3_12,
        handler: "index.lambda_handler",
        code: lambda.Code.fromAsset(
          __dirname + "/../../lambda/daily_medialive_notification",
        ),
        environment: {
          SNS_TOPIC_ARN: snsTopicArn,
        },
        role: lambdaRole,
      },
    );

    // Create a rule to invoke the lambda function at midnight UTC each night
    new events.Rule(this, "DailyMediaLiveNotificationRule", {
      ruleName: Aws.STACK_NAME + "-DailyMediaLiveNotificationRule",
      schedule: events.Schedule.cron({ minute: "0", hour: "0", day: "*", month: "*", year: "*" }),
      targets: [new targets.LambdaFunction(lambdaFunction)],
    });

    return;
  } 



  // This function creates an SNS topic and subscribes to it using the email address specified in userEmail
  createSnsTopicWithSubscription(userEmail: string) {
    // Use the default AWS-provided SNS KMS key
    const awsSNSKey = kms.Alias.fromAliasName(
      this,
      "AWSManagedSNSKey",
      "alias/aws/sns",
    );

    // Create SNS Topic for communicating with workflow owner
    const snsTopic = new sns.Topic(this, "NotificationTopic", {
      displayName: "LEF Notification Topic",
      masterKey: awsSNSKey,
      enforceSSL: true,
    });

    // Subscribe userEmail to SNS topic
    snsTopic.addSubscription(new subscriptions.EmailSubscription(userEmail));

    // Create output to pass SNS topic to event group stack
    new CfnOutput(this, "SnsTopicArn", {
      value: snsTopic.topicArn,
      exportName: Aws.STACK_NAME + "-SnsTopicArn",
      description: "SNS topic ARN for LEF events",
    });

    return snsTopic.topicArn;
  }
}
