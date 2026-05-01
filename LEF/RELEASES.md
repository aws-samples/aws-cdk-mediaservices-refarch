# Release Notes

## v1.1.0 (2026-02-05)

### New Features

- **SRT Caller Input Support**: Added support for SRT (Secure Reliable Transport) Caller inputs in MediaLive
  - MediaLive initiates connections to upstream SRT listeners for low-latency contribution
  - Configurable listener address, port (default: 9000), stream ID, and minimum latency (default: 120ms)
  - Optional AES encryption support (AES128, AES192, AES256) with Secrets Manager integration
  - Ideal for remote production, field contribution, and resilient network scenarios
  - Provides lower latency and better packet loss handling compared to RTMP
- **Simplified SNS Subscription Workflow**: Streamlined deployment process for SNS email notifications
  - **Deploy All Mode**: Single command deployment of all three stacks (Foundation, Event Group, Event) with `--all` flag or explicit stack names
  - Foundation stack creates SNS topic and sends subscription email without waiting
  - Event Group deployment includes subscription verification check (fails fast if not confirmed)
  - Deploy All mode skips subscription check to enable single-command deployment
  - Prominent warning message displayed during Deploy All mode reminding users to confirm email after deployment
  - Supports both step-by-step deployment (confirm email between steps) and all-at-once deployment (confirm after completion)
  - Removed complex custom resource waiter logic in favor of simpler trigger-based verification
- **Lambda Runtime Upgrade**: Updated all Lambda functions to use Python 3.14 runtime
- **Stack Deletion Protection**: Added custom resource deletion checks to prevent accidental deletion of parent stacks with active dependencies
  - Event Group stacks cannot be deleted while Event stacks depend on them
  - Foundation stacks cannot be deleted while Event Group stacks depend on them
  - Lambda-backed custom resources query CloudFormation ListImports API during deletion
  - Provides clear error messages listing dependent stacks that must be deleted first
  - Fail-fast approach blocks deletion before any resources are touched
  - Addresses limitation where cross-stack references alone only fail mid-deletion
- **Multi-Region Foundation Stack Support**: Foundation and Event Group stacks can now be deployed with the same stack name across multiple AWS regions
  - CloudFront policies (CachePolicy, OriginRequestPolicy, ResponseHeadersPolicy) now include 3-letter airport codes in their names
  - IAM roles and Lambda functions in Event Group stacks now include region codes to prevent conflicts
  - Prevents namespace conflicts when deploying identical stack names in different regions
  - Comprehensive region-to-airport-code mapping for all AWS regions (32+ regions covered)
  - Automatic warnings when deploying to unmapped regions with graceful fallback
  - Examples: `MyFoundation-SYD-EMT-ManifestOriginRequestPolicy`, `MyGroup-SYD-CheckValidSnsSubscriptionExistsRole`
- **MediaPackage Preferred Input**: Added support for configuring preferred input in MediaPackage channels
  - Enables specification of which input (1 or 2) MediaPackage should prefer when both inputs are available
  - Only applies to CMAF input type channels
  - Configurable via `inputSwitchConfiguration.preferredInput` in MediaPackage configuration
- **SMPTE 2110 Support**: Added comprehensive support for SMPTE 2110 receiver group settings in MediaLive Anywhere channels
  - Supports VIDEO (SMPTE 2110-20), AUDIO (SMPTE 2110-30), and ANC (SMPTE 2110-40) stream types
  - Configurable multicast IP addresses, ports, and network interface binding
  - Multiple receiver groups per channel for redundancy
  - Implementation uses CDK property overrides until native CDK support is available
- **MediaPackage V2 Access Logging**: Added comprehensive access logging support for MediaPackage V2 channels
  - Configurable at the channel group level for both ingress and egress traffic
  - Multiple destination support: CloudWatch Logs, Amazon S3, and Amazon Data Firehose
  - Disabled by default to avoid unexpected CloudWatch vended log charges
  - Automatic log group naming with channel group isolation: `/aws/mediapackagev2/{channelGroupName}/{logType}AccessLogs`
  - Configurable retention periods, output formats, and S3 partitioning options
  - Uses native CloudFormation resources (`AWS::Logs::DeliverySource`, `AWS::Logs::DeliveryDestination`, `AWS::Logs::Delivery`)
  - Automatic IAM permissions and S3 bucket policies for secure log delivery
  - Cost optimization features including lifecycle policies and configurable retention

### Improvements

- **MediaPackage Manifest Filtering**: Added support for MediaPackage V2 manifest filter configuration
  - Filter manifests by codec (H.264, H.265, AV1), bitrate, resolution, or custom attributes
  - Enables codec-specific manifests for optimized device-based content delivery
  - Supports time-based filtering with start/end timestamps and time delays
  - Configurable for HLS, DASH, and Low-Latency HLS manifest types
  - All filter properties are optional for flexible configuration
- **CDK CLI Usability**: Improved CDK command handling for better developer experience
  - `cdk list`, `cdk destroy --all`, and `cdk synth` now work without requiring `userEmail` parameter
  - Default stack names applied when no stack names provided (not just in deploy-all mode)
  - `userEmail` only required for actual deployments, not for informational commands
  - Clearer error messages when required parameters are missing
- **Encoding Profile Generator B-Frame Configuration**: Updated MediaConvert ad transcode profiles to use `NumberBFramesBetweenReferenceFrames: 2` (previously 0) to prevent audio buildup during ad stitching. This aligns with MediaTailor/MediaConvert team recommendations for minimizing audio synchronization issues. MediaLive live stream profiles remain unchanged.
- **Scalability Improvement**: Updated MediaTailor Playback configuration deployed in Event Group to use CloudFront as the content source rather than MediaPackage directly. This will minimise the manifest requests going back to MediaPackage. This change will cause issues when integrating with the Secure Media Delivery at the Edge solution.
- **MediaTailor URL Configuration**: Added support for `[INSERT_CLOUDFRONT_DOMAIN]` placeholder in both `contentSegmentUrlPrefix` and `adSegmentUrlPrefix` configurations. When this placeholder is used, it automatically resolves to the CloudFront domain name with HTTPS protocol. This simplifies configuration for HLS Interstitial sessions which require absolute ad segment prefixes (relative prefixes would be relative to the page hosting the player, not the stream URL).
- **Event Configuration Optimization**: Updated default event configuration to increase live manifest window to 300 seconds (5 minutes) and set program date time seconds to 1. The increased manifest window reduces the chance of manifests not including any content segments during ad insertion scenarios, which is critical for DRM-enabled streams where players need encrypted content segments to initialize decryption modules. The program date time setting ensures MediaPackage outputs a PDT value for each content segment.
- **MediaTailor Resource Creation Refactoring**: Refactored MediaTailor resource creation logic in event group stack to use a shared `MediaTailorManager` utility class. This eliminates code duplication, improves maintainability, and ensures consistent MediaTailor configuration patterns across different stack types.
- **Event-Level MediaTailor Configuration Support**: Added support for creating one or more event-specific MediaTailor playback configurations within individual events. Events can now define their own MediaTailor configurations in addition to using the default event group configurations, enabling per-event ad insertion customization while maintaining backward compatibility with existing event group-level configurations.
- **CloudFront Fallback Bucket**: Added S3 fallback bucket and origin for CloudFront distributions to handle requests that don't match any defined behaviors
- **Enhanced Resource Tagging**: Introduced comprehensive tagging utility (`TaggingUtils`) to support AWS cost allocation tags across all resource types
  - Added support for different tag formats required by various AWS services (CDK Tags API, CloudFormation tags, and key-value maps)
  - Implemented consistent tagging across MediaLive, MediaPackage, MediaTailor, CloudFront, and other AWS resources
  - Tags can now be enabled as AWS cost allocation tags for improved cost tracking and resource management
- **Configuration Enhancement**: Added `nominalSegmentLength` to foundation configuration while maintaining it in event group configuration. This is require in foundation stack to optimize CloudFront polcies.
- **MediaPackage Segment Configuration Refactoring**: Refactored segment configuration interfaces to use discriminated unions for type-safe CMAF and TS endpoint configuration
  - Created separate `ICmafSegmentConfig` and `ITsSegmentConfig` interfaces with container-specific properties
  - Added TS-specific parameters: `tsUseAudioRenditionGroup` (enables muxed vs demuxed audio) and `tsIncludeDvbSubtitles` (DVB subtitle support)
  - Added CMAF-specific encryption parameters: `cmafExcludeSegmentDrmMetadata` (SEIG/SGPD box exclusion), `constantInitializationVector` (custom IV), and `keyRotationIntervalSeconds` (key rotation interval)
  - Removed redundant `startoverWindowSeconds` from segment configuration (kept at endpoint level only)
  - TypeScript now enforces correct properties based on container type, preventing configuration errors at compile time
  - Enables full AWS MediaPackage V2 feature parity for segment configuration
- **Test Infrastructure Fix**: Fixed NagSuppressions to use dynamic resource references instead of hardcoded paths, resolving test failures in Event Group stack tests
  - Changed from `addResourceSuppressionsByPath()` to `addResourceSuppressions()` with direct resource references
  - All 198 tests now passing successfully
  - Foundation stack exports nominal segment length and validates consistency with event group values
  - Added warning when event group and foundation nominal segment lengths differ to ensure consistent timeout behavior
- Updated 'generate_encoding_profile_set.py' to create dash-cmaf custom transcode profiles.
- Updated encoding profile generator to disable B-frames in ad transcode profiles. While MediaTailor supports B-frames, some players experience transition issues when switching to ads with B-frames.
- Add Security header to CloudFront Response Headers Policies
- Refactored Event Group Stack resource creation order to create CloudFront Distribution before MediaTailor configurations. This ensures CloudFront domain name is available for MediaTailor configuration and improves logical resource dependency flow.
- Updated MediaTailor interface naming for consistency: changed `originHostname` to `originDomainName` to align with AWS service terminology and improve code clarity.
- Updated encoding profiles and sample configurations to remove additional '-' from renditions names. This prevents MediaPackage segments being named 'segment\_-3000_123.mp4' (changing it to 'segment_3000_123.mp4')
- Updated encoding profiles to include frame capture renditions
- **Security Enhancement**: Removed MediaTailor direct access policy from MediaPackage endpoints
  - MediaTailor now exclusively accesses content through CloudFront for improved security
  - Eliminates potential bypass of CloudFront security controls and monitoring
  - Maintains consistent request routing through the CDN layer
- **E2E Integration Tests**: Added comprehensive end-to-end integration tests using CDK integ-runner
  - `integ.deploy-all.ts` - Tests deploying all stacks together
  - `integ.step-by-step.ts` - Tests sequential deployment (Foundation → EventGroup → Event)
  - `integ.multiple-events.ts` - Tests deploying multiple events in the same event group
  - All tests include CloudFormation template snapshots for fast validation without AWS deployment
- **Region Mapping**: Fixed region-to-airport-code mapping to be per-stack instead of singleton
  - Prevents cross-stack reference issues when deploying multiple stacks
  - Each stack now gets its own independent region mapping

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
- Updated '/v1/_segment/_' behaviour to pass headers in origin request. This is to ensure MediaTailor has client header information to include in server side beacon calls.
- Update default configurations to use the MediaPackage output group rather than the CMAF Ingest Output group. Over time the MediaPackage Output group will provide access to more advanced features not supported by the CMAF Ingest standard.

### Bug Fixes

- Fix issue in generate_encoding_profile_set.py. Forces languageCode in encoding profiles to be valid ISO 639-2 three letter
  codes and raise warning if invalid codes are specified.
- Fixed issue to make sure key resources in the project are appropriately tagged.
- Fixed CloudFront cache policy for MediaTailor i-media manifests to use the existing MediaPackage manifest cache policy instead of long-term caching. This ensures proper cache behavior based on origin-provided cache headers rather than fixed TTLs.
- Updated encoding profiles to ensure consistency across different output group types and resolve configuration discrepancies.

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
