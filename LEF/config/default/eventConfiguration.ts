import { IEventConfig } from "../../lib/event/eventConfigInterface";

export const EVENT_CONFIG: IEventConfig = {
  event: {
    mediaLive: {
      encodingProfileLocation:
        "../../encoding-profiles/hd-avc-50fps-sample/medialive-mediapackage-v1.json",
      channelClass: "STANDARD",
      segmentLengthInSeconds: 4,
      inputSpecification: {
        codec: "HEVC",
        maximumBitrate: "MAX_20_MBPS",
        resolution: "HD",
      },
      inputs: [
        {
          inputName: "LiveStream",
          type: "URL_PULL",
          urls: [
            {
              url: "https://fcd796e21ed48a1abb4824e834c02632.p05sqb.channel-assembly.mediatailor.us-west-2.amazonaws.com/v1/channel/Live-event-framework-source-DO-NOT-DELETE/index.m3u8",
            },
            {
              url: "https://fcd796e21ed48a1abb4824e834c02632.p05sqb.channel-assembly.mediatailor.us-west-2.amazonaws.com/v1/channel/Live-event-framework-source-DO-NOT-DELETE/index.m3u8",
            },
          ],
        },
      ],
    },
    // /****** Elemental Live Configuration ***********************************************************************
    //  * To use an Elemental Live Encoder rather than MediaLive, a configuration similar to the below can be used.
    //  ************************************************************************************************************/
    // elementalLive: {
    //   userArn: "arn:aws:iam::012345678910:user/ElementalLiveUser",
    //   inputCidr: [
    //     "8.8.8.8/32",
    //     "9.9.9.9/32"
    //   ]
    // },
    mediaPackage: {
      inputType: "CMAF",
      inputSwitchConfiguration: {
        mqcsInputSwitching: true,
        preferredInput: 1,
      },
      endpoints: {
        cmafEndpoint: {
          containerType: "CMAF",
          originEndpointName: "cmaf",
          resourcePolicyType: "CUSTOM", // PUBLIC: (NOT RECOMMENDED) Allows public access to the endpoint.
          startoverWindowSeconds: 1209600,
          hlsManifests: [
            {
              manifestName: "index",
              childManifestName: "variant",
              manifestWindowSeconds: 300,
              programDateTimeIntervalSeconds: 1,
              scteHls: {
                adMarkerHls: "DATERANGE",
              },
              // Example: Filter to only include renditions up to 720p
              // Useful for creating mobile-optimized manifests
              // filterConfiguration: {
              //   manifestFilter: "video_height:1-720",
              //   // Optional: Add time delay for DVR-like functionality
              //   // timeDelaySeconds: 7200,  // 2 hours
              // }
            },
          ],
          dashManifests: [
            {
              manifestName: "dash",
              manifestWindowSeconds: 300,
              minUpdatePeriodSeconds: 5,
              minBufferTimeSeconds: 8,
              scteDash: {
                adMarkerDash: "XML",
              },
              segmentTemplateFormat: "NUMBER_WITH_TIMELINE",
              suggestedPresentationDelaySeconds: 12,
              // Example: Filter for low-bandwidth scenarios
              // filterConfiguration: {
              //   manifestFilter: "video_bitrate:1-3000000,video_codec:h264",
              //   // timeDelaySeconds: 7200,
              // },
              utcTiming: {
                timingMode: "UTC_DIRECT",
              },
            },
          ],
          segment: {
            segmentName: "segment",
            includeIframeOnlyStreams: false,
            segmentDurationSeconds: 5,
            scte: {
              scteFilter: [
                "SPLICE_INSERT",
                "PROGRAM",
                "BREAK",
                "DISTRIBUTOR_ADVERTISEMENT",
                "DISTRIBUTOR_OVERLAY_PLACEMENT_OPPORTUNITY",
                "DISTRIBUTOR_PLACEMENT_OPPORTUNITY",
                "PROVIDER_ADVERTISEMENT",
                "PROVIDER_OVERLAY_PLACEMENT_OPPORTUNITY",
                "PROVIDER_PLACEMENT_OPPORTUNITY",
              ],
            },
          },
        },
      },
    },
  },
};
