import { IEventGroupConfig } from "../../lib/event_group/eventGroupConfigInterface";

export const EVENT_GROUP_CONFIG: IEventGroupConfig = {
  cloudFront: {
    nominalSegmentLength: 4,
    s3LoggingEnabled: true,
    enableIpv6: true,
    tokenizationFunctionArn: "",
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
};
