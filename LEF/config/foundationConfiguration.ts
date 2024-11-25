import { IFoundationConfig } from '../lib/foundation/foundationConfigInterface';

export const FOUNDATION_CONFIG: IFoundationConfig = {
  cloudFront: {
    logging: {
      logRetentionPeriod: 30 // days
    },
    allowedMediaPackageManifestQueryStrings: [
      'aws.manifestfilter',
      'start',
      'end',
      'time_delay',
      // #########Action Require to enable Low Latency HLS support ##########
      // The _HLS_msn, _HLS_part and _HLS_skip all need to be enabled to support low latency hls
      // playback. They have been disabled by default to eliminate the need for users to raise a
      // support ticket and request an increase in the CloudFront cache key limit above the default
      // of 10. In one of the CloudFront behaviours all the allowedMediaPackageManifestQueryStrings
      // and allowedMediaTailorManifestQueryStrings values need to be included in the origin request
      // policy. Therefore the combined number of query string parameters across
      // allowedMediaTailorManifestQueryStrings and allowedMediaTailorManifestQueryStrings cannot
      // exceed 10 without requesting a limit increase.
      // '_HLS_msn',
      // '_HLS_part',
      // '_HLS_skip',
      // #######################################################################
    ],
    allowedMediaTailorManifestQueryStrings: [
      'aws.sessionId',
      'aws.streamId',
      'aws.logMode',
      'playerParams.content_segment_prefix',
      'playerParams.ad_segment_prefix',
      'playerParams.transcode_profile'
    ]
  }
};