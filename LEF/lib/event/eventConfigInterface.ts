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

import { IEventGroupMediaTailorConfig } from "../event_group/eventGroupConfigInterface";

/**
 * Basic type definitions
 */
export type MediaLiveChannelClass = "STANDARD" | "SINGLE_PIPELINE";

export type Scte35Behavior = "NO_PASSTHROUGH" | "PASSTHROUGH";

export type AdMarkers = "ELEMENTAL_SCTE35" | "ELEMENTAL" | "ADOBE" | "";

export type InputCodec = "MPEG2" | "AVC" | "HEVC";

export type InputMaximumBitrate = "MAX_10_MBPS" | "MAX_20_MBPS" | "MAX_50_MBPS";

export type InputResolution = "SD" | "HD" | "UHD";

export interface InputSpecification {
  /** Codec for input. */
  codec: InputCodec;

  /** Maximum bitrate for input. */
  maximumBitrate: InputMaximumBitrate;

  /** Resolution for input. */
  resolution: InputResolution;
}

export interface ITeletextSourceSettings {
  /** Page number for teletext source. */
  pageNumber: string;
}

export interface ICaptionSelectorSettings {
  /** Teletext source settings. */
  teletextSourceSettings: ITeletextSourceSettings;
}

export interface ICaptionSelector {
  /** Name of the caption selector. */
  name: string;

  /** Language code for the captions. */
  languageCode: string;

  /** Settings for the caption selector. */
  selectorSettings: ICaptionSelectorSettings;
}

/**
 * Configuration for an event in the Live Event Framework.
 */

export type EventSourceConfig =
  | {
      /**
       * Configuration for AWS Elemental MediaLive.
       * @remarks Only one of mediaLive or elementalLive should be configured, not both.
       */
      mediaLive: IMediaLiveConfig;
      elementalLive?: never;
    }
  | {
      mediaLive?: never;
      /**
       * Configuration for Elemental Live.
       * @remarks Only one of mediaLive or elementalLive should be configured, not both.
       * Elemental Live appliances need to be configured with an Access Key pair for an IAM User with permisions
       * to push content to the MediaPackage Channel. An example IAM User can be created using the
       * 'tools/create_elemental_live_user.py' script. The userArn needs to be configured below so the MediaPackage
       * Channel policy can be configured to allow the Elemental Live user to push content to the channel.
       * The 'inputCidr' is an optional range of IP addresses that are allowed to access the MediaPackage Channel.
       */
      elementalLive: IElementalLiveConfig;
    };

export interface IEventConfig {
  event: EventSourceConfig & {
    /**
     * Configuration for AWS Elemental MediaPackage.
     * @remarks Must contain at least one key-value pair defining a MediaPackage endpoint.
     */
    mediaPackage: IMediaPackageChannelConfig;
    /**
     * Optional MediaTailor configurations for event-specific ad insertion.
     * @remarks When specified, creates event-level MediaTailor playback configurations
     * in addition to the default event group configuration.
     */
    mediaTailor?: IEventGroupMediaTailorConfig[];
  };
}

/**
 * Configuration for AWS Elemental MediaLive.
 */
import { MediaLiveInput } from "./inputs/mediaLiveInputTypes";

export interface IMediaLiveConfig {
  /** Location of the encoding profile. */
  encodingProfileLocation: string;

  /** Channel class for MediaLive. */
  channelClass: MediaLiveChannelClass;

  /**
   * MediaLive Anywhere Settings
   * @remarks Only applies to MediaLive Anywhere channels.
   */
  anywhereSettings?: IAnywhereSettingsConfig;

  /**
   * List of input configurations for MediaLive.
   * Supports multiple inputs for channel switching.
   */
  inputs: MediaLiveInput[];

  /** Segment length in seconds. */
  segmentLengthInSeconds: number;

  /** Minimum segment length in seconds */
  minimumSegmentLengthInSeconds?: number;

  /** scte35Behavior for MediaLive HLS/TS Output */
  scte35Behavior?: Scte35Behavior;

  /** HLS Ad Markers */
  adMarkers?: AdMarkers;

  /** Input specification for MediaLive. */
  inputSpecification: InputSpecification;

  /** Enable Input Prepare Schedule Actions */
  enableInputPrepareScheduleActions?: boolean;

  /** Enable Output Static Image Overlay Schedule Actions */
  enableStaticImageOverlayScheduleActions?: boolean;

  /** Caption selectors configuration */
  captionSelectors?: ICaptionSelector[];
}

/**
 * Configuration for MediaLive Anywhere Settings
 */
export interface IAnywhereSettingsConfig {
  /** Channel Placement Group for Channel. */
  channelPlacementGroupId: string;

  /** Cluster MediaLive Anywhere channel will run on. */
  clusterId: string;
}

/**
 * Configuration for MediaLive Multicast Input Settings
 */
export interface IMulticastSettingsConfig {
  sources: IMulticastSource[];
}

/**
 * Configuration for MediaLive Multicast Source
 *
 * @typedef {Object} IMulticastSource
 * @property {string} [sourceIp] - The multicast source IP address (224.0.0.0 to 239.255.255.255)
 * @property {string} url - Multicast URL (format: udp://<ip-address>:<port>)
 *
 * @example
 * {
 *   sourceIp: "224.0.0.0",
 *   url: "udp://239.0.0.1:5000"
 * }
 */
export interface IMulticastSource {
  sourceIp?: string;
  url: string;
}

/**
 * Configuration for Elemental Live Appliances.
 */
export interface IElementalLiveConfig {
  /** ARN of the IAM user for Elemental Live. */
  userArn: string;

  /** Array of input CIDRs. */
  inputCidr: string[];
}

/** MediaPackage Endpoints */
export interface IMediaPackageEndpointsConfig {
  [key: string]: IMediaPackageEndpointConfig;
}

/**
 * Configuration for MediaPackage input switching based on MQCS.
 */
export interface IInputSwitchConfig {
  /**
   * When true, AWS Elemental MediaPackage performs input switching based on the MQCS.
   * Default is true. This setting is valid only when inputType is CMAF.
   */
  mqcsInputSwitching?: boolean;

  /**
   * Input switching mode for failover behavior.
   * @values "FAILOVER_ON_AVERAGE" | "FAILOVER_ON_INSTANTANEOUS"
   */
  inputSwitchingMode?: "FAILOVER_ON_AVERAGE" | "FAILOVER_ON_INSTANTANEOUS";

  /**
   * Threshold for input switching (0-100).
   * Lower values make switching more sensitive.
   */
  switchingThreshold?: number;

  /**
   * Preferred input for MediaPackage channel.
   * When specified, MediaPackage will prefer this input when both inputs are available.
   * @values 1 | 2
   */
  preferredInput?: 1 | 2;
}

/**
 * Configuration for MediaPackage output header settings.
 */
export interface IOutputHeaderConfig {
  /**
   * When true, AWS Elemental MediaPackage includes the MQCS in responses to the CDN.
   * This setting is valid only when inputType is CMAF.
   */
  publishMqcs?: boolean;

  /** Additional CMSD headers to include in responses */
  additionalHeaders?: {
    /** Include buffer health information in CMSD headers */
    includeBufferHealth?: boolean;
    /** Include throughput information in CMSD headers */
    includeThroughput?: boolean;
  };
}

/**
 * Configuration for MediaPackage channel policy.
 */
export interface IChannelPolicyConfig {
  /** Enable automatic channel policy attachment */
  enabled: boolean;

  /**
   * Array of CIDR blocks allowed to push content to the channel.
   * If specified, only these IP ranges can send content to MediaPackage.
   */
  allowedCidrBlocks?: string[];

  /**
   * Custom IAM policy statements to add to the channel policy.
   * Use this for advanced access control scenarios.
   */
  customPolicyStatements?: any[]; // Will be converted to iam.PolicyStatement[]
}

/**
 * Configuration for a MediaPackage channel.
 */
export interface IMediaPackageChannelConfig {
  /** Input type
   * @values "HLS" | "CMAF"
   */
  inputType: "HLS" | "CMAF";

  /** Custom description for the channel */
  description?: string;

  /**
   * Configuration for input switching based on the media quality confidence score (MQCS)
   * as provided from AWS Elemental MediaLive. Only applies to CMAF input type.
   */
  inputSwitchConfiguration?: IInputSwitchConfig;

  /**
   * Settings for what common media server data (CMSD) headers AWS Elemental MediaPackage
   * includes in responses to the CDN. Only applies to CMAF input type.
   */
  outputHeaderConfiguration?: IOutputHeaderConfig;

  /** Channel policy configuration */
  channelPolicy?: IChannelPolicyConfig;

  endpoints: IMediaPackageEndpointsConfig;
}

/**
 * Configuration for a MediaPackage endpoint.
 */
/**
 * Base endpoint configuration shared by all container types.
 */
interface IBaseEndpointConfig {
  /** Name of the origin endpoint. */
  originEndpointName: string;

  /**
   * Type of resource policy.
   * @remarks PUBLIC: (NOT RECOMMENDED) Allows public access to the endpoint.
   * CUSTOM: Restricts access to the endpoint to the Event Group CloudFront Distribution
   * and MediaTailor Playback configuration. This should be the default setting
   * but cannot be set as the default until MediaTailor supports the signing of
   * requests to MediaPackage V2 Origin.
   * Enabling the custom policy before the account supports MediaTailor signing
   * requests to the origin will break the MediaTailor workflow.
   * @values "PUBLIC" | "CUSTOM"
   */
  resourcePolicyType: "PUBLIC" | "CUSTOM";

  /** Startover window in seconds. */
  startoverWindowSeconds: number;

  /** Configuration for DASH manifests. */
  dashManifests?: IDashManifestConfig[];
}

/**
 * CMAF endpoint configuration.
 */
interface ICmafEndpointConfig extends IBaseEndpointConfig {
  /**
   * Container type for the endpoint.
   */
  containerType: "CMAF";

  /** Configuration for HLS manifests. */
  hlsManifests?: ICmafHlsManifestConfig[];

  /** Configuration for low latency HLS manifests. */
  lowLatencyHlsManifests?: ICmafHlsManifestConfig[];

  /** Configuration for CMAF segments. */
  segment: ICmafSegmentConfig;
}

/**
 * TS endpoint configuration.
 */
interface ITsEndpointConfig extends IBaseEndpointConfig {
  /**
   * Container type for the endpoint.
   */
  containerType: "TS";

  /** Configuration for HLS manifests. */
  hlsManifests?: ITsHlsManifestConfig[];

  /** Configuration for low latency HLS manifests. */
  lowLatencyHlsManifests?: ITsHlsManifestConfig[];

  /** Configuration for TS segments. */
  segment: ITsSegmentConfig;
}

/**
 * Endpoint configuration - type varies based on container type.
 */
export type IMediaPackageEndpointConfig =
  | ICmafEndpointConfig
  | ITsEndpointConfig;

/**
 * Configuration for a manifest.
 */
export interface IManifestConfig {
  /**
   * Name of the manifest.
   * @pattern ^[A-Za-z0-9-]+$
   * @remarks Must contain only A-Z, a-z, 0-9, and - (hyphen) characters.
   */
  manifestName: string;

  /**
   * Name of the child manifest.
   * @pattern ^[A-Za-z0-9-]+$
   * @remarks Must contain only A-Z, a-z, 0-9, and - (hyphen) characters.
   */
  childManifestName: string;

  /**
   * Manifest window in seconds.
   * @remarks When using DRM it is advisable to set manifestWindowSeconds
   * to be larger than the longest ad break. This ensures all manifests
   * delivered to the players include at least one encrypted segment.
   * If the manifest does not include an encrypted segment, because a
   * player has joined the stream during an ad break, the player will
   * not have sufficient information to initialise the session for DRM.
   */
  manifestWindowSeconds: number;

  /**
   * Program date time interval in seconds.
   * @remarks For MediaTailor workflows the programDateTimeIntervalSeconds
   * value should be set equal to or less than the segment length. With
   * this configuration MediaPackage will insert a PDT between every segment
   * in the manifest. This will provide MediaTailor with the most accurate
   * PDT information to make ad insertion decisions.
   */
  programDateTimeIntervalSeconds: number;

  /**
   * Whether to URL encode child manifest URLs in the parent manifest.
   * Default is true.
   */
  urlEncodeChildManifest?: boolean;

  /**
   * Configuration for manifest filtering.
   * Allows creating different manifests with different renditions from the same channel.
   *
   * @example
   * ```typescript
   * filterConfiguration: {
   *   manifestFilter: "video_height:1-720",  // Only include renditions up to 720p
   *   timeDelaySeconds: 3600,                // 1 hour delay for DVR
   * }
   * ```
   */
  filterConfiguration?: {
    /**
     * Manifest filter expression.
     *
     * Format: "attribute:min-max" or "attribute:value"
     * Multiple filters: Separate with commas (AND logic)
     *
     * Common attributes:
     * - video_height: Vertical resolution (e.g., "1-720")
     * - video_width: Horizontal resolution
     * - video_bitrate: Video bitrate in bps (e.g., "1-3000000")
     * - video_codec: Codec type ("h264", "h265", "av1") - case insensitive
     * - audio_language: Language code (e.g., "en")
     * - audio_bitrate: Audio bitrate in bps
     *
     * @example "video_height:1-720,video_codec:h264"
     * @maxLength 1024
     */
    manifestFilter?: string;

    /**
     * Start time for the manifest.
     * When specified, cannot use start time query parameters.
     *
     * @format ISO 8601 (YYYY-MM-DDThh:mm:ss+00:00)
     * @example "2024-01-01T00:00:00+00:00"
     */
    start?: string;

    /**
     * End time for the manifest.
     * When specified, cannot use end time query parameters.
     *
     * @format ISO 8601 (YYYY-MM-DDThh:mm:ss+00:00)
     * @example "2024-01-01T23:59:59+00:00"
     */
    end?: string;

    /**
     * Time delay in seconds for manifest egress requests.
     * Must be smaller than the endpoint's startover window.
     * When specified, cannot use time delay query parameters.
     *
     * @minimum 0
     * @maximum 1209600 (14 days)
     * @example 7200 (2 hours)
     */
    timeDelaySeconds?: number;

    /**
     * Clip start time for manifest egress requests.
     * When specified, cannot use clip start time query parameters.
     *
     * @format ISO 8601 (YYYY-MM-DDThh:mm:ss+00:00)
     */
    clipStartTime?: string;

    /**
     * DRM settings for manifest egress requests.
     * When specified, cannot use identical DRM setting query parameters.
     *
     * @maxLength 1024
     */
    drmSettings?: string;
  };
}

/**
 * HLS manifest configuration for CMAF endpoints.
 */
export interface ICmafHlsManifestConfig extends IManifestConfig {
  /** Configuration for SCTE in HLS. */
  scteHls: {
    /**
     * Ad marker for HLS in CMAF containers.
     * @values "DATERANGE"
     */
    adMarkerHls: "DATERANGE";
  };
}

/**
 * HLS manifest configuration for TS endpoints.
 */
export interface ITsHlsManifestConfig extends IManifestConfig {
  /** Configuration for SCTE in HLS. */
  scteHls: {
    /**
     * Ad marker for HLS in TS containers.
     * @values "DATERANGE" | "SCTE35_ENHANCED"
     */
    adMarkerHls: "DATERANGE" | "SCTE35_ENHANCED";
  };
}

/**
 * Configuration for a DASH manifest.
 */
interface IDashManifestConfig extends Omit<
  IManifestConfig,
  "childManifestName" | "programDateTimeIntervalSeconds"
> {
  /** Minimum update period in seconds. */
  minUpdatePeriodSeconds: number;

  /** Minimum buffer time in seconds. */
  minBufferTimeSeconds: number;

  /** Configuration for SCTE in DASH. */
  scteDash: {
    /**
     * Ad marker for DASH.
     * @values "XML" | "BINARY"
     */
    adMarkerDash: string;
  };

  /** Configuration for UTC Timing */
  utcTiming?:
    | {
        /** Timing method for DASH. */
        timingMode: "UTC_DIRECT";
      }
    | {
        /** Timing method for DASH. */
        timingMode: "HTTP_HEAD" | "HTTP_ISO" | "HTTP_XSDATE";
        /** Timing URL for DASH. */
        timingSource?: string;
      };

  /**
   * Segment template format.
   * @values "NUMBER_WITH_TIMELINE"
   */
  segmentTemplateFormat: string;

  /** Suggested presentation delay in seconds. */
  suggestedPresentationDelaySeconds: number;

  /**
   * DRM signaling determines the way DASH manifest signals the DRM content.
   * @values "INDIVIDUAL" | "REFERENCED"
   */
  drmSignaling?: "INDIVIDUAL" | "REFERENCED";
}

/**
 * Configuration for segments.
 */
/**
 * Base segment configuration shared by all container types.
 */
interface IBaseSegmentConfig {
  /**
   * Name of the segment.
   * @pattern ^[A-Za-z0-9-]+$
   * @remarks Must contain only A-Z, a-z, 0-9, and - (hyphen) characters.
   */
  segmentName: string;

  /** Whether to include iframe-only streams. */
  includeIframeOnlyStreams: boolean;

  /** Segment duration in seconds. */
  segmentDurationSeconds: number;

  /** Configuration for SCTE. */
  scte: {
    /** Array of SCTE filters. */
    scteFilter: string[];
  };
}

/**
 * SPEKE key provider configuration.
 */
interface ISpekeKeyProvider {
  /** Array of DRM systems. */
  drmSystems: Array<
    "FAIRPLAY" | "WIDEVINE" | "PLAYREADY" | "IRDETO" | "CLEAR_KEY_AES_128"
  >;

  /** Encryption contract configuration. */
  encryptionContractConfiguration: Record<string, unknown>;

  /** resourceId unique identifier for the content. */
  resourceId: string;

  /** roleArn ARN of the role assumed by SPEKE. */
  roleArn: string;

  /** SPEKE key Provider URL */
  url: string;
}

/**
 * CMAF-specific segment configuration.
 */
interface ICmafSegmentConfig extends IBaseSegmentConfig {
  /** Configuration for encryption. */
  encryption?: {
    /** Encryption method configuration. */
    encryptionMethod: {
      /**
       * CMAF encryption method.
       * @values "CENC" | "CBCS"
       */
      cmafEncryptionMethod?: "CENC" | "CBCS";
    };

    /**
     * Exclude SEIG and SGPD boxes from CMAF segment metadata.
     * Improves compatibility with certain players that don't support these boxes.
     * @default false
     */
    cmafExcludeSegmentDrmMetadata?: boolean;

    /**
     * Custom constant initialization vector (32-character hex string).
     * If not specified, MediaPackage creates the IV.
     */
    constantInitializationVector?: string;

    /**
     * Key rotation interval in seconds.
     * Interval to rotate encryption keys for the origin endpoint.
     */
    keyRotationIntervalSeconds?: number;

    /** SPEKE key provider configuration. */
    spekeKeyProvider: ISpekeKeyProvider;
  };
}

/**
 * TS-specific segment configuration.
 */
interface ITsSegmentConfig extends IBaseSegmentConfig {
  /**
   * Whether to use audio rendition groups for TS segments.
   * When false, creates muxed audio/video in single TS stream.
   * @default true
   */
  tsUseAudioRenditionGroup?: boolean;

  /**
   * Whether to include DVB subtitles in TS segments.
   * @default false
   */
  tsIncludeDvbSubtitles?: boolean;

  /** Configuration for encryption. */
  encryption?: {
    /** Encryption method configuration. */
    encryptionMethod: {
      /**
       * TS encryption method.
       * @values "AES-128" | "SAMPLE_AES"
       */
      tsEncryptionMethod?: "AES_128" | "SAMPLE_AES";
    };

    /**
     * Custom constant initialization vector (32-character hex string).
     * If not specified, MediaPackage creates the IV.
     */
    constantInitializationVector?: string;

    /**
     * Key rotation interval in seconds.
     * Interval to rotate encryption keys for the origin endpoint.
     */
    keyRotationIntervalSeconds?: number;

    /** SPEKE key provider configuration. */
    spekeKeyProvider: ISpekeKeyProvider;
  };
}

/**
 * Segment configuration - type varies based on container type.
 */
type ISegmentConfig = ICmafSegmentConfig | ITsSegmentConfig;
