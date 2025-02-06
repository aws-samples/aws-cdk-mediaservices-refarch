# Release Notes

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

### Bug Fixes
- CloudFront Behaviour Optimizations:
  - Update /v1/segments/* and /v1/dashsegments/* behaviours to cache requests. Requests are cached to prevent duplicate server side tracking beacons being sent by MediaTailor when customer rewatches an ad period.
  - Introduced specific CloudFront Cache and Origin Request Policies for Ad Captions segments
  - Disable caching on /v1/tracking/* behaviour
  - Ordered behaviours to group behaviours for similar functions across DASH and HLS Streams
- generate_encoding_profile_set.py updated to enforce the use of 3 letter language codes. Previously, script was using 2 letter codes.

### Breaking Changes
- None
