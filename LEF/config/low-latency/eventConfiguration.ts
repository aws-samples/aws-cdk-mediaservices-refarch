import { IEventConfig } from '../../lib/event/eventConfigInterface';

export const EVENT_CONFIG: IEventConfig = {
  event: {
    mediaLive: {
      encodingProfileLocation: "../../encoding-profiles/low-latency-hd-avc-50fps-sample/medialive-cmaf-ingest-v1.json",
      channelClass: "STANDARD",
      inputType: "URL_PULL",
      segmentLengthInSeconds: 1,
      inputSpecification: {
        codec: "HEVC",
        maximumBitrate: "MAX_20_MBPS",
        resolution: "HD"
      },
      rtmpStreamName: "live",
      sourceEndBehavior: 'LOOP',
      priLink: "",
      secLink: "",
      inputCidr: "0.0.0.0/0",
      priUrl: "https://fcd796e21ed48a1abb4824e834c02632.p05sqb.channel-assembly.mediatailor.us-west-2.amazonaws.com/v1/channel/Live-event-framework-source-DO-NOT-DELETE/index.m3u8",
      secUrl: "https://fcd796e21ed48a1abb4824e834c02632.p05sqb.channel-assembly.mediatailor.us-west-2.amazonaws.com/v1/channel/Live-event-framework-source-DO-NOT-DELETE/index.m3u8",
      priFlow: "",
      secFlow: ""
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
      endpoints: {
        cmafEndpoint: {
          containerType: "CMAF",
          originEndpointName: "cmaf",
          resourcePolicyType: "PUBLIC",  // PUBLIC: (NOT RECOMMENDED) Allows public access to the endpoint.
          startoverWindowSeconds: 1209600,
          hlsManifests: [
            {
              manifestName: "index",
              childManifestName: "variant",
              manifestWindowSeconds: 60,
              programDateTimeIntervalSeconds: 60,
              scteHls: {
                adMarkerHls: "DATERANGE"
              },
              // filterConfiguration: {
              //   manifestFilter: "video_height:1-720",
              //   start: "YYYY-MM-DDThh:mm:ss+00:00",
              //   end: "YYYY-MM-DDThh:mm:ss+00:00",
              //   timeDelaySeconds: 7200
              // }
            }
          ],
          dashManifests: [
            {
              manifestName: "dash",
              manifestWindowSeconds: 60,
              minUpdatePeriodSeconds: 4,
              minBufferTimeSeconds: 4,
              scteDash: {
                adMarkerDash: "XML"
              },
              segmentTemplateFormat: "NUMBER_WITH_TIMELINE",
              suggestedPresentationDelaySeconds: 10,
              // filterConfiguration: {
              //   manifestFilter: "video_height:1-720",
              //   start: "YYYY-MM-DDThh:mm:ss+00:00",
              //   end: "YYYY-MM-DDThh:mm:ss+00:00",
              //   timeDelaySeconds: 7200
              // },
              utcTiming: {
                timingMode: "UTC_DIRECT"
              }
            }
          ],
          lowLatencyHlsManifests: [
            {
              manifestName: "low-latency-index",
              childManifestName: "low-latency-variant",
              manifestWindowSeconds: 60,
              programDateTimeIntervalSeconds: 60,
              scteHls: {
                adMarkerHls: "DATERANGE"
              },
              // filterConfiguration: {
              //   manifestFilter: "video_height:1-720",
              //   start: "YYYY-MM-DDThh:mm:ss+00:00",
              //   end: "YYYY-MM-DDThh:mm:ss+00:00",
              //   timeDelaySeconds: 7200
              // }
            }
          ],
          segment: {
            segmentName: "segment",
            includeIframeOnlyStreams: false,
            startoverWindowSeconds: 1209600,
            segmentDurationSeconds: 4,
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
                "PROVIDER_PLACEMENT_OPPORTUNITY"
              ]
            }
          }
        }
      }
    }
  }
};
