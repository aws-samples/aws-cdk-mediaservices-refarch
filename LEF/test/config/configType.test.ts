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

import { ConfigType } from "../../lib/config/configValidator";
import { IEventConfig } from "../../lib/event/eventConfigInterface";
import { IEventGroupConfig } from "../../lib/event_group/eventGroupConfigInterface";
import { IFoundationConfig } from "../../lib/foundation/foundationConfigInterface";

describe('ConfigType', () => {
  test('should accept IEventConfig as ConfigType', () => {
    // This is a type test, so we're just verifying that TypeScript accepts these assignments
    // Create a minimal valid IEventConfig
    const eventConfig: IEventConfig = {
      event: {
        mediaLive: {
          encodingProfileLocation: '/path/to/profile.json',
          channelClass: 'STANDARD',
          inputs: [
            {
              type: 'URL_PULL',
              urls: [
                {
                  url: 'http://example.com/stream'
                }
              ],
              sourceEndBehavior: 'CONTINUE',
            }
          ],
          segmentLengthInSeconds: 4,
          inputSpecification: {
            codec: 'AVC',
            maximumBitrate: 'MAX_10_MBPS',
            resolution: 'HD'
          },
        },
        mediaPackage: {
          inputType: 'HLS',
          endpoints: {
            hls: {
              containerType: 'TS',
              originEndpointName: 'test-endpoint',
              resourcePolicyType: 'PUBLIC',
              startoverWindowSeconds: 300,
              segment: {
                segmentName: 'test-segment',
                includeIframeOnlyStreams: false,
                startoverWindowSeconds: 300,
                segmentDurationSeconds: 6,
                scte: {
                  scteFilter: []
                }
              }
            }
          }
        }
      }
    };
    
    // TypeScript will error if this assignment is invalid
    const configType: ConfigType = eventConfig;
    
    // Simple assertion to make Jest happy
    expect(configType).toBeDefined();
  });
  
  test('should accept IEventGroupConfig as ConfigType', () => {
    // Create a minimal valid IEventGroupConfig
    const eventGroupConfig: IEventGroupConfig = {
      cloudFront: {
        nominalSegmentLength: 4,
        s3LoggingEnabled: false,
        enableIpv6: true
      },
      mediaTailor: [
        {
          name: "default",
          adDecisionServerUrl: 'https://example.com/ads',
          contentSegmentUrlPrefix: 'https://example.com/content',
          adSegmentUrlPrefix: 'https://example.com/ad',
          adMarkerPassthrough: false,
          slateAdUrl: 'https://example.com/slate'
        }
      ]
    };
    
    // TypeScript will error if this assignment is invalid
    const configType: ConfigType = eventGroupConfig;
    
    // Simple assertion to make Jest happy
    expect(configType).toBeDefined();
  });
  
  test('should accept IFoundationConfig as ConfigType', () => {
    // Create a minimal valid IFoundationConfig
    const foundationConfig: IFoundationConfig = {
      cloudFront: {
        logging: {
          logRetentionPeriod: 30
        },
        allowedMediaPackageManifestQueryStrings: [],
        allowedMediaTailorManifestQueryStrings: "ALL"
      }
    };
    
    // TypeScript will error if this assignment is invalid
    const configType: ConfigType = foundationConfig;
    
    // Simple assertion to make Jest happy
    expect(configType).toBeDefined();
  });
});