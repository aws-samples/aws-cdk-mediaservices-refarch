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

export interface IEventGroupConfig {
  cloudFront: IEventGroupCloudFrontConfig;
  mediaTailor: IEventGroupMediaTailorConfig[];
  /**
   * MediaPackage V2 access logging configuration.
   * @remarks
   * Configures access logging at the channel group level for both ingress and egress traffic.
   * Logging is disabled by default to avoid unexpected CloudWatch vended log charges.
   */
  mediaPackageLogging?: IMediaPackageLoggingConfig;
}

export interface IEventGroupCloudFrontConfig {
  nominalSegmentLength: number;
  /** Configure CloudFront S3 Logging
   * Foundation stack applies a default 30 day retention policy to this bucket.
   * Logs older than the retention period will be removed to minimise S3 charges
   * @values true | false
   */
  s3LoggingEnabled: boolean;
  enableIpv6: boolean;
  /** Enable Origin Shield to add an additional caching layer
   * @values true | false
   * @default false
   * @remarks Origin Shield is a CloudFront feature that provides additional caching layers
   * to reduce latency and improve overall performance.
   *
   */
  enableOriginShield?: boolean;
  /** AWS Region for Origin Shield
   * Must be a valid AWS Region where Origin Shield is available
   * @example "us-east-1"
   */
  originShieldRegion?: string;
  /** Tokenization function ARN
   * @remarks CloudFront Function deployed by Secure Media Delivery at the Edge
   * on AWS Solution (https://aws.amazon.com/solutions/implementations/secure-media-delivery-at-the-edge/)
   */
  tokenizationFunctionArn?: string;
  /** CloudFront Key Group ID
   * @remarks CloudFront Key Group ID to use when applying viewer restrictions to behaviours
   */
  keyGroupId?: string[];
  /** AWS WAF Web ACL configuration
   * @remarks WAF Web ACL must be created in us-east-1 for CloudFront distributions
   */
  waf?: {
    /** Enable WAF Web ACL creation
     * @default false
     */
    enabled?: boolean;
    /** Existing Web ACL ARN to associate (optional)
     * If provided, no new Web ACL will be created
     * If not provided, a new Web ACL with AWS Managed Rules will be created
     * @example "arn:aws:wafv2:us-east-1:123456789012:global/webacl/example/a1b2c3d4-5678-90ab-cdef-EXAMPLE11111"
     */
    webAclArn?: string;
    /** List of IPv4 addresses to allow (CIDR notation)
     * These IPs will bypass all other WAF rules
     * @example ["192.0.2.0/24", "198.51.100.0/24"]
     */
    allowedIpv4Addresses?: string[];
    /** List of 2-letter country codes to allow
     * If specified, all other countries will be blocked
     * Uses ISO 3166-1 alpha-2 country codes
     * @example ["US", "CA", "GB"]
     */
    allowedCountryCodes?: string[];
    /** Enable AWS Managed Rules - Anonymous IP List
     * Blocks requests from VPNs, proxies, Tor, and anonymization services
     * @default false
     */
    blockAnonymousIps?: boolean;
  };
}

export interface IEventGroupMediaTailorConfig {
  /**
   * Name of the MediaTailor configuration
   * This will be used as part of the configuration name and in the CloudFront path pattern
   */
  name?: string;
  adDecisionServerUrl: string;
  contentSegmentUrlPrefix: string;
  adSegmentUrlPrefix: string;
  adMarkerPassthrough?: boolean;
  /**
   * Defines the maximum duration of underfilled ad time (in seconds) allowed in an ad break
   * before MediaTailor will abandon personalization of the ad break.
   */
  personalizationThreshold?: number | undefined;
  /**
   * URL for slate ad content that will be used if ad content is not available
   * @default ""
   */
  slateAdUrl?: string;
  /**
   * Bumper
   * Documentation - https://docs.aws.amazon.com/mediatailor/latest/ug/bumpers.html
   *
   * Sample bumpers have been configured below. The bumpers can be customised or disabled depending on the
   * desired user experience.
   */
  bumper?: {
    startUrl: string;
    endUrl: string;
  };

  /**
   * PreRollAdDecisionServerUrl
   * Documentation - https://docs.aws.amazon.com/mediatailor/latest/ug/ad-behavior-preroll.html
   */
  preRolladDecisionServerUrl?: string;
  /**
   * PreRollDuration
   * Documentation - https://docs.aws.amazon.com/mediatailor/latest/ug/ad-behavior-preroll.html
   */
  preRollDuration?: number;
  /**
   * Avail Suppression Configuration
   * Documentation - https://docs.aws.amazon.com/mediatailor/latest/ug/ad-suppression.html
   * Avail Suppression is disabled as the configuration of this option is highly dependent on how streams
   * will be used by customers.
   */
  availSuppression?: {
    /**
     * @values 'OFF' | 'BEHIND_LIVE_EDGE' | 'AFTER_LIVE_EDGE'
     */
    mode: "OFF" | "BEHIND_LIVE_EDGE" | "AFTER_LIVE_EDGE";
    /**
     * @format HH:MM:SS
     * @example "00:00:30" for 30 seconds
     */
    value: string;
    /**
     * @values 'PARTIAL_AVAIL' | 'FULL_AVAIL_ONLY'
     */
    fillPolicy: "PARTIAL_AVAIL" | "FULL_AVAIL_ONLY";
  };
  /**
   * MediaTailor log percentage configuration (0-100).
   *
   * Controls what percentage of MediaTailor sessions are logged to CloudWatch.
   *
   * Recommended values:
   * - Development: 100 (full logging for debugging)
   * - Production: 10 or less (cost-optimized)
   * - High-volume: 5 or less (minimal cost impact)
   *
   * Note: Individual sessions can be forced to log by adding aws.logMode=DEBUG
   * to session initialization, regardless of this global setting.
   *
   * @default 100 (if not specified)
   * @minimum 0
   * @maximum 100
   */
  logPercentageEnabled?: number;
  /**
   * Insertion mode for MediaTailor ad insertion
   * @values 'STITCHED_ONLY' | 'PLAYER_SELECT'
   * @default 'STITCHED_ONLY' (if not specified)
   * @remarks
   * - STITCHED_ONLY: Traditional server-side ad insertion (default behavior)
   * - PLAYER_SELECT: Client-side ad insertion with player control over ad playback
   */
  insertionMode?: "STITCHED_ONLY" | "PLAYER_SELECT";
  /**
   * Specify custom transcode profiles to be used for HLS and DASH outputs.
   * If not specified, MediaTailor will create a dynamic transcode profiles.
   * @type {object}
   * @remarks
   * With the introduction of CMAF dynamic transcode profiles MediaTailor can now transcode CMAF ads without requiring a
   * custom transcode profile. This has the advantage a single MediaTailor Configuration can be used for
   * any stream type. As a result of this enhancement the project has been modified to not utilize custom transcode profiles
   * by default. Custom transcode profiles can be enabled by following
   * the guidance in the README.md to enable custom transcode profiles.
   * @example
   * {
   *    hlsCmaf: "hd-avc-50fps-sample-mediatailor-hls-cmaf-v1",
   *    dashCmaf: "hd-avc-50fps-sample-mediatailor-dash-v1"
   * }
   */
  transcodeProfiles?:
    | { hlsCmaf: string; dashCmaf?: string }
    | { hlsCmaf?: string; dashCmaf: string }
    | { hlsCmaf: string; dashCmaf: string };
}

/**
 * Configuration for MediaPackage V2 access logging.
 *
 * MediaPackage V2 provides access logs that capture detailed information about requests
 * sent to your channels. Logging is configured at the channel group level and supports
 * multiple destinations including CloudWatch Logs, Amazon S3, and Amazon Data Firehose.
 *
 * @remarks
 * - Logging is disabled by default to avoid unexpected costs
 * - Up to 3 log deliveries can be configured per log type (ingress/egress)
 * - CloudWatch vended log charges apply when logging is enabled
 * - Cross-account delivery is supported with proper IAM policies
 */
export interface IMediaPackageLoggingConfig {
  /**
   * Enable or disable MediaPackage access logging.
   * @default false
   */
  enabled: boolean;

  /**
   * Configuration for egress access logs (requests sent to endpoints).
   * @remarks Maximum of 3 delivery configurations per log type
   */
  egressAccessLogs?: ILogDeliveryConfig[];

  /**
   * Configuration for ingress access logs (requests sent to channel inputs).
   * @remarks Maximum of 3 delivery configurations per log type
   */
  ingressAccessLogs?: ILogDeliveryConfig[];
}

/**
 * Configuration for a single log delivery destination.
 *
 * Defines where and how MediaPackage access logs should be delivered.
 * Each delivery configuration specifies a destination type and associated settings.
 */
export interface ILogDeliveryConfig {
  /**
   * Type of destination for log delivery.
   * @values "CLOUDWATCH_LOGS" | "S3" | "FIREHOSE"
   */
  destinationType: "CLOUDWATCH_LOGS" | "S3" | "FIREHOSE";

  /**
   * ARN of the destination resource.
   * @remarks
   * - CloudWatch Logs: Log group ARN (optional, will create if not specified)
   * - S3: Bucket ARN
   * - Firehose: Delivery stream ARN
   */
  destinationArn?: string;

  /**
   * Output format for the log records.
   * @default "json"
   * @values "json" | "plain" | "w3c" | "raw" | "parquet"
   */
  outputFormat?: "json" | "plain" | "w3c" | "raw" | "parquet";

  /**
   * Specific log fields to include in each log record.
   * @remarks If not specified, all available fields are included
   */
  fieldSelection?: string[];

  /**
   * Character used to separate log fields in the output.
   * @default "\t" (tab character)
   */
  fieldDelimiter?: string;

  // S3-specific configuration options
  /**
   * Suffix path for partitioning S3 data.
   * @remarks
   * Available fields: {accountid}, {region}, {channel_group_id}, {yyyy}, {MM}, {dd}, {HH}
   * @example "year={yyyy}/month={MM}/day={dd}/hour={HH}"
   */
  s3Suffix?: string;

  /**
   * Enable Hive-compatible S3 paths for analytics tools.
   * @default false
   * @remarks Only applicable when destinationType is "S3"
   */
  hiveCompatible?: boolean;

  // CloudWatch Logs-specific configuration options
  /**
   * Custom CloudWatch log group name.
   * @default "/aws/mediapackagev2/{channelGroupName}/egressAccessLogs" or "/aws/mediapackagev2/{channelGroupName}/ingressAccessLogs"
   * @remarks Only applicable when destinationType is "CLOUDWATCH_LOGS"
   */
  logGroupName?: string;

  /**
   * Log retention period in days.
   * @default 30
   * @remarks Only applicable when destinationType is "CLOUDWATCH_LOGS"
   */
  retentionInDays?: number;
}
