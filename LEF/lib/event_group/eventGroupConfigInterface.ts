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
  insertionMode?: 'STITCHED_ONLY' | 'PLAYER_SELECT';
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
