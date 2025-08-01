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
export interface IMediaPackageEndpointConfig {
  /**
   * Container type for the endpoint.
   * @values "CMAF" | "TS"
   */
  containerType: "CMAF" | "TS";

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

  /** Configuration for HLS manifests. */
  hlsManifests?: IManifestConfig[];

  /** Configuration for low latency HLS manifests. */
  lowLatencyHlsManifests?: IManifestConfig[];

  /** Configuration for DASH manifests. */
  dashManifests?: IDashManifestConfig[];

  /** Configuration for segments. */
  segment: ISegmentConfig;
}

/**
 * Configuration for a manifest.
 */
export interface IManifestConfig {
  /** Name of the manifest. */
  manifestName: string;

  /** Name of the child manifest. */
  childManifestName: string;

  /** Manifest window in seconds. */
  manifestWindowSeconds: number;

  /** Program date time interval in seconds. */
  programDateTimeIntervalSeconds: number;

  /** 
   * Whether to URL encode child manifest URLs in the parent manifest.
   * Default is true.
   */
  urlEncodeChildManifest?: boolean;

  /** Configuration for SCTE in HLS. */
  scteHls: {
    /**
     * Ad marker for HLS.
     * @values "DATERANGE"
     */
    adMarkerHls: string;
  };

  /** Configuration for manifest filtering. */
  filterConfiguration?: {
    /** Manifest filter. */
    manifestFilter: string;

    /**
     * Start time for the manifest.
     * @format YYYY-MM-DDThh:mm:ss+00:00
     */
    start: string;

    /**
     * End time for the manifest.
     * @format YYYY-MM-DDThh:mm:ss+00:00
     */
    end: string;

    /** Time delay in seconds. */
    timeDelaySeconds: number;
  };
}

/**
 * Configuration for a DASH manifest.
 */
interface IDashManifestConfig
  extends Omit<
    IManifestConfig,
    "childManifestName" | "scteHls" | "programDateTimeIntervalSeconds"
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
interface ISegmentConfig {
  /** Name of the segment. */
  segmentName: string;

  /** Whether to include iframe-only streams. */
  includeIframeOnlyStreams: boolean;

  /** Startover window in seconds. */
  startoverWindowSeconds: number;

  /** Segment duration in seconds. */
  segmentDurationSeconds: number;

  /** Configuration for SCTE. */
  scte: {
    /** Array of SCTE filters. */
    scteFilter: string[];
  };

  /** Configuration for encryption. */
  encryption?: {
    /** Encryption method configuration. */
    encryptionMethod: {
      /**
       * CMAF encryption method.
       * @values "CENC" | "CBCS"
       */
      cmafEncryptionMethod?: "CENC" | "CBCS";

      /**
       * TS encryption method.
       * @values "AES-128" | "SAMPLE_AES"
       */
      tsEncryptionMethod?: "AES-128" | "SAMPLE_AES";
    };

    /** SPEKE key provider configuration. */
    spekeKeyProvider: {
      /** Array of DRM systems. */
      drmSystems: Array<"FAIRPLAY" | "WIDEVINE" | "PLAYREADY" | "IRDETO">;

      /** Encryption contract configuration. */
      encryptionContractConfiguration: Record<string, unknown>;

      /* resourceId unique identifier for the content. */
      resourceId: string;

      /* roleArn ARN of the role assumed by SPEKE. */
      roleArn: string;

      /* SPEKE key Provider URL */
      url: string;
    };
  };
}
