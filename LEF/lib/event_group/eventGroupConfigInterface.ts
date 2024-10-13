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
  mediaTailor: IEventGroupMediaTailorConfig;
};

export interface IEventGroupCloudFrontConfig {
  nominalSegmentLength: number;
  /** Configure CloudFront S3 Logging
   * Foundation stack applies a default 30 day retention policy to this bucket.
   * Logs older than the retention period will be removed to minimise S3 charges
   * @values true | false
  */
  s3LoggingEnabled: boolean;
  enableIpv6: boolean;
  /** Tokenization function ARN
   * @remarks CloudFront Function deployed by Secure Media Delivery at the Edge
   * on AWS Solution (https://aws.amazon.com/solutions/implementations/secure-media-delivery-at-the-edge/)
  */
  tokenizationFunctionArn?: string;
};

export interface IEventGroupMediaTailorConfig {
  adDecisionServerUrl: string;
  contentSegmentUrl: string;
  adSegmentUrl: string;
  adMarkerPassthrough: boolean;
  /**
   * Defines the maximum duration of underfilled ad time (in seconds) allowed in an ad break.
   * Value has been set to a relatively large value of 120 seconds. This value as selected to
   * help protect against scenarios where a very long SCTE break has accidentally been inserted
   * upstream. This value should be adjusted based on the expected duration of your SCTE breaks.
   */
  personalizationThreshold: number;
  slateAdUrl: string;
  /**
   * Bumper
   * Documentation - https://docs.aws.amazon.com/mediatailor/latest/ug/bumpers.html
   * 
   * Sample bumpers have been configured below. The bumpers can be customised or disabled depending on the
   * desired user experience.
   */
  bumper: {
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
    mode: 'OFF' | 'BEHIND_LIVE_EDGE' | 'AFTER_LIVE_EDGE';
    /**
     * @format HH:MM:SS
     * @example "00:00:30" for 30 seconds
     */
    value: string;
    /**
     * @values 'PARTIAL_AVAIL' | 'FULL_AVAIL_ONLY'
     */
    fillPolicy: 'PARTIAL_AVAIL' | 'FULL_AVAIL_ONLY';
  };
  /**
   * PENDING IMPLEMENTATION: logPrecentageEnabled has not yet been implemented. 
   * The logPercentage enabled has been set to the default value of 100 percent. Valid values are between 0 and 100.
   * For integration it is useful to log all sessions to simplify troubleshooting. For production deployments logging
   * 100% of sessions can incur significant CloudWatch Log charges. In these cases it may be more cost effective to reduce
   * the log percentage to a value less than 100% (perhaps 5%). Using log sampling it is still possible to get reasonable
   * visibility of how the service is operating while reducing overall costs.
   * Remember if a specific session needs to be logged this can be achieved by adding the aws.logMode=DEBUG to the session
   * initialization.
   */
  logPrecentageEnabled?: number;
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
};