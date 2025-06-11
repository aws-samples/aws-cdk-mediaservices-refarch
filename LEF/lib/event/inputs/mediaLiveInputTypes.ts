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
 * Base interface for all MediaLive input types.
 * @interface IBaseInput
 * @property {string} [inputName] - Optional name identifier for the input
 */
export interface IBaseInput {
  /** Optional name identifier for the input */
  inputName?: string;
}

/**
 * Interface for Multicast input configuration in MediaLive
 * @interface IMulticastInput
 * @extends IBaseInput
 * @property {string} type - Must be "MULTICAST"
 * @property {Object} multicastSettings - Configuration for multicast sources
 * @example
 * {
 *   "inputName": "Primary-Multicast",
 *   "type": "MULTICAST",
 *   "multicastSettings": {
 *     "sources": [{
 *       "url": "udp://239.1.1.1:5000",
 *       "sourceIp": "10.0.0.1"
 *     }]
 *   }
 * }
 */
export interface IMulticastInput extends IBaseInput {
  /** Input type identifier */
  type: "MULTICAST";
  /** Settings for multicast input configuration */
  multicastSettings: {
    /** Array of multicast source configurations */
    sources: IMulticastSources[];
  };
}

/**
 * Configuration for individual multicast sources
 * @interface IMulticastSources
 * @property {string} url - The URL of the multicast source
 * @property {string} sourceIp - The source IP address for the multicast
 */
export interface IMulticastSources {
  /** URL of the multicast source */
  url: string;
  /** Source IP address for the multicast */
  sourceIp: string;
}

/**
 * Interface for MediaConnect input configuration
 * @interface IMediaConnectInput
 * @extends IBaseInput
 * @property {string} type - Must be "MEDIACONNECT"
 * @property {string[]} arnList - List of ARNs for MediaConnect flows
 * @example
 * {
 *   "inputName": "Primary-MediaConnect",
 *   "type": "MEDIACONNECT",
 *   "arnList": [
 *     "arn:aws:mediaconnect:us-west-2:111122223333:flow:1-23aBC45dEF-12ab:main"
 *   ],
 *  "roleArn":
 * }
 */
export interface IMediaConnectInput extends IBaseInput {
  /** Input type identifier */
  type: "MEDIACONNECT";
  /** List of Amazon Resource Names (ARNs) for MediaConnect flows */
  arnList: string[];
  /** Role ARN */
  roleArn: string;
}

/**
 * Interface for Input Device configuration
 * @interface IInputDeviceInput
 * @extends IBaseInput
 * @property {string} type - Must be "INPUT_DEVICE"
 * @property {string} deviceId - The ID of the input device
 * @example
 * {
 *   "inputName": "Primary-Device",
 *   "type": "INPUT_DEVICE",
 *   "deviceId": "device-1234abcd5678efgh"
 * }
 */
export interface IInputDeviceInput extends IBaseInput {
  /** Input type identifier */
  type: "INPUT_DEVICE";
  /** Unique identifier for the input device */
  deviceId: string;
}

/**
 * Interface for RTP Push input configuration
 * @interface IRtpPushInput
 * @extends IBaseInput
 * @property {string} type - Must be "RTP_PUSH"
 * @property {string[]} cidr - List of CIDR blocks for input security group
 * @example
 * {
 *   "inputName": "Primary-RTP",
 *   "type": "RTP_PUSH",
 *   "cidr": ["10.0.0.0/16", "192.168.0.0/24"]
 * }
 */
export interface IRtpPushInput extends IBaseInput {
  /** Input type identifier */
  type: "RTP_PUSH";
  /** Array of CIDR blocks for configuring input security groups */
  cidr: string[];
}

/**
 * Interface for RTMP Push input configuration
 * @interface IRtmpPushInput
 * @extends IBaseInput
 * @property {string} type - Must be "RTMP_PUSH"
 * @property {string[]} cidr - List of CIDR blocks for input security group
 * @example
 * {
 *   "inputName": "Primary-RTMP-Push",
 *   "type": "RTMP_PUSH",
 *   "cidr": ["10.0.0.0/16", "192.168.0.0/24"]
 * }
 */
export interface IRtmpPushInput extends IBaseInput {
  /** Input type identifier */
  type: "RTMP_PUSH";
  /** Array of CIDR blocks for configuring input security groups */
  cidr: string[];
}

/**
 * Interface for RTMP Pull input configuration
 * @interface IRtmpPullInput
 * @extends IBaseInput
 * @property {string} type - Must be "RTMP_PULL"
 * @property {string[]} urls - List of RTMP source URLs to pull from
 * @property {string} [username] - Optional username for authentication
 * @property {string} [password] - Optional password for authentication
 * @example
 * {
 *   "inputName": "Primary-RTMP-Pull",
 *   "type": "RTMP_PULL",
 *   "urls": ["rtmp://live.example.com/live/stream1"],
 *   "username": "user123",
 *   "password": process.env.STREAM1_PASSWORD, // import dotenv
 * }
 */
export interface IRtmpPullInput extends IBaseInput {
  /** Input type identifier */
  type: "RTMP_PULL";
  /** Array of RTMP source URLs to pull content from */
  urls: string[];
  /** Optional username for RTMP authentication */
  username?: string;
  /** Optional password for RTMP authentication */
  password?: string;
}

/**
 * Interface for URL Pull input configuration
 * @interface IUrlPullInput
 * @extends IBaseInput
 * @property {string} type - Must be "URL_PULL"
 * @property {string[]} urls - List of source URLs to pull from
 * @property {string} [username] - Optional username for authentication
 * @property {string} [password] - Optional password for authentication
 * @example
 * {
 *   "inputName": "Primary-URL-Pull",
 *   "type": "URL_PULL",
 *   "urls": [
 *     {
 *       url: "https://example1.com/live/stream1.m3u8",
 *       username: "user123",
 *       password: process.env.STREAM1_PASSWORD, // import dotenv,
 *     },
 *     {
 *       url: "https://example2.com/live/stream2.m3u8",
 *       username: "user456",
 *       password: process.env.STREAM2_PASSWORD, // import dotenv,
 *     },* }
 */
export interface IUrlPullInput extends IBaseInput {
  /** Input type identifier */
  type: "URL_PULL";
  /** Array of URL configurations for content pull */
  urls: Array<{
    /** URL to pull content from */
    url: string;
    /** Optional username for URL authentication */
    username?: string;
    /** Optional password for URL authentication */
    password?: string;
  }>;
}

/**
 * Interface for File input configuration
 * @interface IFileInput
 * @extends IBaseInput
 * @property {("MP4_FILE" | "TS_FILE")} type - Type of file input (MP4 or Transport Stream)
 * @property {string} bucket - S3 bucket containing the input files
 * @property {string} filePrefix - Prefix for the input files in the S3 bucket
 * @example
 * {
 *   "inputName": "VOD-Input",
 *   "type": "MP4_FILE",
 *   "urls": ["s3://content-bucker/vod/stream1.mp4"],
 * }
 */
export interface IFileInput extends IBaseInput {
  /** Input type identifier (MP4 or Transport Stream) */
  type: "MP4_FILE" | "TS_FILE";
  /** Array of URLs specifying the location of the files */
  urls: string[];
}

/**
 * Union type representing all possible MediaLive input configurations
 * This type combines all available input interfaces to define valid input types
 * for AWS Elemental MediaLive channels
 * @typedef MediaLiveInput
 */
export type MediaLiveInput =
  | IMulticastInput
  | IInputDeviceInput
  | IRtpPushInput
  | IRtmpPushInput
  | IRtmpPullInput
  | IMediaConnectInput
  | IUrlPullInput
  | IFileInput;
