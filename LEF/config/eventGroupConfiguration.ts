import { IEventGroupConfig } from '../lib/event_group/eventGroupConfigInterface';

export const EVENT_GROUP_CONFIG: IEventGroupConfig = {
  cloudFront: {
    nominalSegmentLength: 4,
    s3LoggingEnabled: true,
    enableIpv6: true,
    tokenizationFunctionArn: '',
  },
  mediaTailor: {
    adDecisionServerUrl: 'https://n8ljfs0h09.execute-api.us-west-2.amazonaws.com/v1/ads?duration=[session.avail_duration_secs]',
    contentSegmentUrl: '[player_params.content_segment_prefix]',
    adSegmentUrl: '[player_params.ad_segment_prefix]',
    adMarkerPassthrough: false,
    personalizationThreshold: 120,
    slateAdUrl: 'https://d1zxfw9n55b23r.cloudfront.net/interstitials/SlateAd.mov',
    bumper: {
      startUrl: 'https://d1zxfw9n55b23r.cloudfront.net/interstitials/Bumper.mov',
      endUrl: 'https://d1zxfw9n55b23r.cloudfront.net/interstitials/Bumper.mov',
    }
  },
};
