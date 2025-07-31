# Release Notes

## v1.0.4 (2024-07-30)

### New Features
- Add support for multiple MediaLive inputs in a single channel.
- Set Medialive 'Enable Blackout Slate' so encoder blanking encoder responds to Network Start and Network End scheduled
  actions.
- Create tools/medialive-scheduled-actions/sendMediaLiveScheduledActions.py to simplify sending scheduled actions to
  MediaLive from the command line.
- Add support for configuring MediaPackage Output Group on MediaLive Channel. Default configurations continue to use HLS/TS Ingest.
- Enable the 'Enable input switch based on MQCS' and 'Enable MQCS publishing in Common Media Server Data (CMSD)' options by default for MediaPackage CMAF Ingest channels
- **MediaTailor Insertion Mode Configuration**: Added support for configuring MediaTailor insertion mode in event group configurations
  - Added `insertionMode` property to `IEventGroupMediaTailorConfig` interface
  - Supports both `STITCHED_ONLY` (default) and `PLAYER_SELECT` modes
  - Enables client-side ad insertion scenarios when using `PLAYER_SELECT`
  - Updated `generate_uris.sh` script to focus on server-side ad insertion and MediaPackage playback URLs
  - Simplified URL generation for better usability and testing workflows

### Improvements

- CloudFront '/v1/w*' behaviour was changed to '/v1/webvtt/<ACCOUNT_ID>/*'. This behaviour is used to retrieve WebVTT captions
  segments from MediaTailor during ad breaks. This is to ensure players continue to have a captions track during ad breaks
  even though ads often do not include captions. The more explicit naming also provides more information about the purpose of
  the behaviour.
- Implement support for Teletext captions. Support for additional captions formats (already supported by MediaLive) can be
  implemented at a later date based on demand.
- Added support for configuration of the `urlEncodeChildManifest` setting on HLS and low latency HLS manifests. This setting has been defaulted to `true` to make HLS timeshift responses compatible with common players.
- Simplified implementation by setting MediaTailor contentSegmentUrlPrefix and adSegmentUrlPrefix to '/'. This makes URLs in
  manifests relative to the root and removes the complication of the '../' notation. This also avoids the need to pass
  content_segment_prefix and ad_segment_prefix query strings when initializing a session.
- Update CloudFront Origins to reference `segments.mediatailor.${Aws.REGION}.amazonaws.com` for ad segments. The previously configured domain is a legacy domain and new customers should use the new domain.
- Update tools/encoding-profile-generator to set framerates in custom transcode profiles with a timescale multiplier of 1000. This will produce video segments more aligned with the output of MediaPackage V2 and reduce likelihood of players encountering issues on ad transitions.
- Enable support for logConfiguration in eventGroupConfiguration. This addresses the previous known limitation.
- Update CloudFront Origin for MediaTailor to reference `manifests.mediatailor.${Aws.REGION}.amazonaws.com`. This change allows multiple MediaTailor configurations to be utilised without requiring CloudFront behaviours to be modified for each Playback configuration.
- Updated '/v1/*segment/*' behaviour to pass headers in origin request. This is to ensure MediaTailor has client header information to include in server side beacon calls.
- Update default configurations to use the MediaPackage output group rather than the CMAF Ingest Output group. Over time the MediaPackage Output group will provide access to more advanced features not supported by the CMAF Ingest standard.

### Bug Fixes

- Fix issue in generate_encoding_profile_set.py. Forces languageCode in encoding profiles to be valid ISO 639-2 three letter
  codes and raise warning if invalid codes are specified.
- Fixed issue to make sure key resources in the project are appropriately tagged.

### Breaking Changes

- The implementation of support for multiple MediaTailor Playback configurations in an Event Group will required a redeployment
  of all the stacks as new output parameters have been introduced in the Event Group stack and the Event stack requires these
  values.
- The Foundation stack needs to be updated following this release as the "mediapackagev2:GetChannel" action was added to the MediaLive Role. Without this role MediaLive will be unable to push content to a MediaPackage V2 channel using the MediaPackage Output Group in MediaLive.

## v1.0.3 (2024-04-03)

### New Features

- Introduce support for MediaLive Anywhere channel deployment
- Introduced configuration option in foundation configuration for CloudFront to pass 'ALL' query strings through to MediaTailor.
- Add '/v1/i-media/\*' behaviour to CloudFront Distribution to support Server Guided Ad Insertion.
- Implemented 'enableOriginShield' and 'originShieldRegion' configuration parameters for CloudFront Origin Shield in Event Group Stack
- Support the configuration of multiple MediaTailor Playback configuration in an Event Group.

### Improvements

- Consolidate CloudFront behaviour for /v1/segment/\* and /v1/dashsegment/\* into a single /v1/\*segment/\* behaviour.
- MediaPackage V2 introduced support for the 'aws.manifestsettings' query parameter. 'aws.manifestsettings' can include values for start, end and time_delay settings. As 'aws.manifestsettings' is the preferred approach for dynamically specifying start, end and time_delay query parameters in requests ot MediaPackage, the standalone start, end and time_delay parameters have been removed from the framework.
- Remove unnecessary CloudFront Origin Request Policies:
  - When no Origin Request Policy is specified only the headers, query strings and cookies included in the Cache policy are included in origin requests.
  - For CloudFront Behaviours when caching is disabled Origin request policies are still required to ensure appropriate headers, query strings and cookies are included in origin requests.
- Refined CloudFront '/out/v1/\*.m3u8', '/out/v1/\*.mpd' and '/out/v1/\*' behaviours to also include event group name (i.e. '/out/v1/<channelGroup>/\*.m3u8', '/out/v1/<channelGroup>/\*.mpd' and '/out/v1/<channelGroup>/\*'). This ensures only requests for the supported channel group will be directed to the configured MediaPackage Channel Group.
- Implement tagging of resources
- Refactor tools/load_custom_transcode_profiles.py to simplify maintenance.
- Refactor MediaLive input handling and implement unit tests.

### Bug Fixes

- CloudFront behaviour for /v1/tracking\* was incorrectly configured for POST requests. This behaviour is for the [client-side tracking API](https://docs.aws.amazon.com/mediatailor/latest/ug/ad-reporting-client-side.html) used to provide the player with visibility of ad breaks which can be used to implement logic on the player side (e.g. disable player controls during ad breaks or ad break count down timers). The API is unique for each session use GET requests which should not be cached in CloudFront.
- Configure MediaLive Global settings to use System Clock for the Output Timing Source. This is intended to prevent the output drifting relative to time as the quality of the clock in the input is unknown.
- Fix bug preventing multiple allowed CIDR blocks being configured for MediaLive push inputs.

### Breaking Changes

- The format for event configuration files has been changed to make it more intuitive to configure MediaLive input types.

## v1.0.2 (2024-11-22)

### New Features

- Support MediaPackage V2 CMAF Ingest
- Support for utcTiming configuration on MediaPackage DASH Manifests
- Enable Frame Capture rendition on MediaLive sample encoding profiles
- Include option to configure CloudFront Key Group ID to be applied to all behaviours in CloudFront Distribution and implement viewer restrictions.

### Improvements

- Improve security by setting resourcePolicyType to CUSTOM on the MediaPackage Origin Endpoint. This change configures a policy on the MediaPackage endpoint with statements to only allow access from the MediaTailor and CloudFront resources deployed by the Live Event Framework.
- Moved default configuration files from 'config' folder to 'config/default' folder. This change was required to make room for additional pre-canned sets of configuration files for different use cases (e.g. low latency HLS).
- Sample encoding profile updates
  - Remove ac3 and eac3 audio tracks from sample profiles to reduce cost of running workflow (This can still be configured by creating your own custom profiles using tools/encoding-profile-generator)
  - Enhanced tools/encoding-profile-generator to generate MediaLive encoding profile using the CMAF Ingest output group. This is in addition to the existing MediaLive encoding profile using a HLS output group.
  - Include support for generation of profiles with audio in multiple languages
- Updated README.md with CloudShell deployment instructions
- Changed default MediaTailor settings to:
  - Disable bumpers
  - Disable setting of Personalization Threshold
- Update Packages
- Upgrade AWS Lambda Function run times to PYTHON_3_13
- Set CloudFront Error TTL to a fixed value of 1 second regardless of segment size. Previously, this TTL may have been set to half a segment length for segment sizes > 2
- Refactor stack validation logic to simplify maintenance and improve reuse across stacks.

### Bug Fixes

- CloudFront Behaviour Optimizations:
  - Update /v1/segments/_ and /v1/dashsegments/_ behaviours to cache requests. Requests are cached to prevent duplicate server side tracking beacons being sent by MediaTailor when customer rewatches an ad period.
  - Introduced specific CloudFront Cache and Origin Request Policies for Ad Captions segments
  - Disable caching on /v1/tracking/\* behaviour
  - Ordered behaviours to group behaviours for similar functions across DASH and HLS Streams
- generate_encoding_profile_set.py updated to enforce the use of 3 letter language codes. Previously, script was using 2 letter codes.

### Breaking Changes

- None
