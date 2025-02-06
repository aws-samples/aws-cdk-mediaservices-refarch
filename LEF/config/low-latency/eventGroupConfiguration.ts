import { IEventGroupConfig } from '../../lib/event_group/eventGroupConfigInterface';

export const EVENT_GROUP_CONFIG: IEventGroupConfig = {
  cloudFront: {
    nominalSegmentLength: 1,
    s3LoggingEnabled: true,
    enableIpv6: true,
    tokenizationFunctionArn: '',
  },
  mediaTailor: {
    adDecisionServerUrl: 'https://n8ljfs0h09.execute-api.us-west-2.amazonaws.com/v1/ads?duration=[session.avail_duration_secs]',
    contentSegmentUrl: '[player_params.content_segment_prefix]',
    adSegmentUrl: '[player_params.ad_segment_prefix]',
    adMarkerPassthrough: false,
    slateAdUrl: 'https://d1zxfw9n55b23r.cloudfront.net/interstitials/SlateAd.mov',
    // Bumpers can be enabled by uncommenting the 'bumper' section below.
    // bumper: {
    //   startUrl: 'https://d1zxfw9n55b23r.cloudfront.net/interstitials/Bumper.mov',
    //   endUrl: 'https://d1zxfw9n55b23r.cloudfront.net/interstitials/Bumper.mov',
    // },
  },
};
