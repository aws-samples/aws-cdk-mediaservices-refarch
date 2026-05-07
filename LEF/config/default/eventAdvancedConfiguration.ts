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
          resourcePolicyType: "CUSTOM",
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
    mediaTailor: [
      {
        name: "",
        adDecisionServerUrl:
          "https://n8ljfs0h09.execute-api.us-west-2.amazonaws.com/v1/ads?duration=[session.avail_duration_secs]&availIndex=[avail.index]&scor=[session.id]&correlator=[avail.random]",
        contentSegmentUrlPrefix: "/",
        adSegmentUrlPrefix: "/",
        slateAdUrl:
          "https://d1zxfw9n55b23r.cloudfront.net/interstitials/SlateAd.mov",
        logPercentageEnabled: 10,
        insertionMode: "PLAYER_SELECT",
        // Bumpers can be enabled by uncommenting the 'bumper' section below.
        // bumper: {
        //   startUrl: 'https://d1zxfw9n55b23r.cloudfront.net/interstitials/Bumper.mov',
        //   endUrl: 'https://d1zxfw9n55b23r.cloudfront.net/interstitials/Bumper.mov',
        // },
      },
    ],
  },
};
