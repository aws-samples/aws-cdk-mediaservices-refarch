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

/** Top-level project configuration */
export interface IInferenceConfig {
  /** MediaConnect source configuration */
  mediaConnect: IMediaConnectConfig;
  /** Elemental Inference feature toggles */
  inference: IInferenceFeatureConfig;
  /** Video encoding configuration */
  videoConfig: IVideoConfig;
  /** MediaPackageV2 channel group name */
  channelGroupName: string;
  /** Callback metadata string for EventBridge filtering */
  callbackMetadata: string;
}

/** MediaConnect source parameters */
export interface IMediaConnectConfig {
  /** Source protocol — default: "srt-listener" */
  protocol: "srt-listener" | "zixi-push" | "rtp-fec" | "rtp";
  /** Allowlist CIDR for the source (required when not using VPC interfaces) */
  whitelistCidr?: string;
  /** Optional VPC interface configuration */
  vpcConfig?: IVpcConfig;
}

/** VPC interface configuration for MediaConnect */
export interface IVpcConfig {
  subnetId: string;
  securityGroupIds: string[];
}

/** Elemental Inference feature toggles */
export interface IInferenceFeatureConfig {
  /** Enable Smart Crop (SMART_CROP video descriptions) */
  enableSmartCrop: boolean;
  /** Enable Event Clipping (Clipping feed output + EventBridge) */
  enableClipping: boolean;
}

/** Video encoding parameters for ABR ladder */
export interface IVideoConfig {
  horizontal: IVideoRendition[];
  vertical: IVideoRendition[];
}

/** Individual video rendition configuration */
export interface IVideoRendition {
  /** Display name for the video description */
  name: string;
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
  /** Max bitrate in bps for QVBR */
  maxBitrate: number;
  /** QVBR quality level (1-10) */
  qvbrQualityLevel: number;
}
