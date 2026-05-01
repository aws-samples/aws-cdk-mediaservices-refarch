import { IEventConfig } from "../../lib/event/eventConfigInterface";

export const EVENT_CONFIG: IEventConfig = {
  event: {
    mediaLive: {
      encodingProfileLocation:
        "../../encoding-profiles/hd-avc-50fps-sample/medialive-mediapackage-v1.json",
      channelClass: "SINGLE_PIPELINE",
      segmentLengthInSeconds: 4,
      // MediaLive Anywhere settings are required for SMPTE 2110 inputs
      anywhereSettings: {
        channelPlacementGroupId: "your-placement-group-id",
        clusterId: "your-cluster-id",
      },
      inputSpecification: {
        codec: "HEVC",
        maximumBitrate: "MAX_20_MBPS",
        resolution: "HD",
      },
      inputs: [
        {
          inputName: "SMPTE2110-Primary",
          type: "SMPTE_2110",
          smpte2110ReceiverGroupSettings: {
            receiverGroupId: "rg-primary",
            receivers: [
              {
                receiverId: "video-primary",
                multicastIp: "239.1.1.10",
                port: 5000,
                interfaceId: "eth0",
                streamType: "VIDEO",
              },
              {
                receiverId: "audio-primary-left",
                multicastIp: "239.1.1.11",
                port: 5001,
                interfaceId: "eth0",
                streamType: "AUDIO",
              },
              {
                receiverId: "audio-primary-right",
                multicastIp: "239.1.1.12",
                port: 5002,
                interfaceId: "eth0",
                streamType: "AUDIO",
              },
              {
                receiverId: "anc-primary",
                multicastIp: "239.1.1.13",
                port: 5003,
                interfaceId: "eth0",
                streamType: "ANC",
              },
            ],
          },
        },
        // Optional: Add a backup SMPTE 2110 input for redundancy
        {
          inputName: "SMPTE2110-Backup",
          type: "SMPTE_2110",
          smpte2110ReceiverGroupSettings: {
            receiverGroupId: "rg-backup",
            receivers: [
              {
                receiverId: "video-backup",
                multicastIp: "239.1.2.10",
                port: 5000,
                interfaceId: "eth1",
                streamType: "VIDEO",
              },
              {
                receiverId: "audio-backup-left",
                multicastIp: "239.1.2.11",
                port: 5001,
                interfaceId: "eth1",
                streamType: "AUDIO",
              },
              {
                receiverId: "audio-backup-right",
                multicastIp: "239.1.2.12",
                port: 5002,
                interfaceId: "eth1",
                streamType: "AUDIO",
              },
              {
                receiverId: "anc-backup",
                multicastIp: "239.1.2.13",
                port: 5003,
                interfaceId: "eth1",
                streamType: "ANC",
              },
            ],
          },
        },
      ],
    },
    mediaPackage: {
      inputType: "CMAF",
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
              manifestWindowSeconds: 43200,
              programDateTimeIntervalSeconds: 60,
              scteHls: {
                adMarkerHls: "DATERANGE",
              },
            },
          ],
          dashManifests: [
            {
              manifestName: "dash",
              manifestWindowSeconds: 60,
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
  },
};
