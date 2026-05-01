# Testing and Tools Guide

This guide covers testing procedures, tools, and utilities for the Live Event Framework.

## Quick Testing

### Start Your Channel

Use the provided script to start your MediaLive channel:

```bash
./tools/start_channel.sh
```

**Example Output**:

```bash
Starting MediaLive Channel: 1234567
Channel 1234567 is not started
...
Channel 1234567 is started
```

The script:

- Parses CloudFormation outputs to get channel ID
- Starts the MediaLive channel
- Polls until channel is running
- Reports status updates

### Generate Playback URLs

Generate all playback URLs for testing:

```bash
./tools/generate_uris.sh
```

**Example Output**:

```console
DASH/CMAF Stream
========================================
MediaPackage Playback URL : https://d2kzr1fexample.cloudfront.net/out/v1/LefGroup1/LefGroup1Event1/cmaf/dash.mpd
MediaTailor Session Initialization Demo UI Links:
- Explicit Session Initialization: https://d195a5eb2n34sr.cloudfront.net?url=https://d2kzr1fexample.cloudfront.net/v1/session/64aeecfad278cEXAMPLEbb569fe792461EXAMPLE/LefGroup1/out/v1/LefGroup1/LefGroup1Event1/cmaf/dash.mpd&playerparams=[{"key":"content_segment_prefix","value":"dash-cmaf"},{"key":"ad_segment_prefix","value":"dash-cmaf"}]&serverreporting=true
- Implicit Session Initialization: https://d195a5eb2n34sr.cloudfront.net?url=https://d2kzr1fexample.cloudfront.net/v1/dash/64aeecfad278cEXAMPLEbb569fe792461EXAMPLE/LefGroup1/out/v1/LefGroup1/LefGroup1Event1/cmaf/dash.mpd&playerparams=[{"key":"content_segment_prefix","value":"dash-cmaf"},{"key":"ad_segment_prefix","value":"dash-cmaf"}]&serverreporting=true

HLS/CMAF Stream
========================================
MediaPackage Playback URL : https://d2kzr1fexample.cloudfront.net/out/v1/LefGroup1/LefGroup1Event1/cmaf/index.m3u8
MediaTailor Session Initialization Demo UI Links:
- Explicit Session Initialization: https://d195a5eb2n34sr.cloudfront.net?url=https://d2kzr1fexample.cloudfront.net/v1/session/64aeecfad278cEXAMPLEbb569fe792461EXAMPLE/LefGroup1/out/v1/LefGroup1/LefGroup1Event1/cmaf/index.m3u8&playerparams=[{"key":"content_segment_prefix","value":"hls-cmaf"},{"key":"ad_segment_prefix","value":"hls-cmaf"}]&serverreporting=true
- Implicit Session Initialization: https://d195a5eb2n34sr.cloudfront.net?url=https://d2kzr1fexample.cloudfront.net/v1/master/64aeecfad278cEXAMPLEbb569fe792461EXAMPLE/LefGroup1/out/v1/LefGroup1/LefGroup1Event1/cmaf/index.m3u8&playerparams=[{"key":"content_segment_prefix","value":"hls-cmaf"},{"key":"ad_segment_prefix","value":"hls-cmaf"}]&serverreporting=true
```

## URL Types Explained

### MediaPackage URLs (Direct)

**Use When**: No ad insertion required (most cost-effective)

**HLS**: `https://cloudfront-domain/out/v1/group/channel/cmaf/index.m3u8`
**DASH**: `https://cloudfront-domain/out/v1/group/channel/cmaf/dash.mpd`

**Benefits**:

- Direct content delivery
- No MediaTailor charges
- Lowest latency
- Simplest integration

### MediaTailor URLs (Ad Insertion)

**Use When**: Server-side ad insertion required

**Session Initialization**: `https://cloudfront-domain/v1/session/config-id/...`
**HLS Playback**: `https://cloudfront-domain/v1/master/config-id/...`  
**DASH Playback**: `https://cloudfront-domain/v1/dash/config-id/...`

**Benefits**:

- Server-side ad stitching
- Personalized ad insertion
- Advanced targeting capabilities
- Comprehensive analytics

### Event-Specific URLs

When events define their own MediaTailor configurations, additional URLs are generated:

**Primary Configuration** (empty name):

- Used for default outputs
- Standard URL format

**Named Configurations**:

- Separate URLs for each named configuration
- Enables A/B testing scenarios
- Individual configuration analytics

## Test Players

### Server Side Ad Insertion Test Player

**URL**: https://d195a5eb2n34sr.cloudfront.net

**Features**:

- MediaTailor session initialization testing
- Both explicit and implicit session modes
- Player parameter configuration
- Server-side reporting validation

**Usage**:

1. Click generated test player links from `generate_uris.sh`
2. Configure player parameters as needed
3. Test different session initialization modes
4. Validate ad insertion behavior

### Direct Player URLs

The `generate_uris.sh` script also provides links to:

- **DASH-IF Reference Player**: Standards-compliant DASH playback
- **HLS.js Demo**: JavaScript-based HLS playback in browsers

## MediaTailor Session Testing

### Explicit Session Initialization Example

```bash
function mediaTailorExplicitSessionInit() {
    sessionUrl=$1
    streamType=$2

    echo -e "\033[1;30mMediaTailor Session URL:\033[0m \033[0;34m$sessionUrl\033[0m"
    echo -e "\033[1;30mMediaTailor Stream Type:\033[0m \033[0;34m$streamType\033[0m"

    # Get CloudFront Hostname
    CLOUDFRONT_HOSTNAME=`echo $sessionUrl | awk -F[/:] '{ print $4 }'`
    echo -e "\033[1;30mCloudFront Distribution Hostname:\033[0m \033[0;34m$CLOUDFRONT_HOSTNAME\033[0m"

    # Curl MediaTailor to get manifest URL
    SESSION_INIT_RESPONSE=$(curl --no-progress-meter -X POST "${sessionUrl}" -d "{ \
    \"reportingMode\": \"SERVER\", \
    \"playerParams\": {
                        \"content_segment_prefix\": \"${streamType}\", \
                        \"ad_segment_prefix\": \"${streamType}\" \
                    } }" 2>&1)

    # Check if curl returned an error
    if [ $? -ne 0 ]; then
        echo -e "\033[1;31mError: curl command failed with error:\033[0m"
        echo "$SESSION_INIT_RESPONSE"
        return 1
    fi

    echo -e "\033[1;30mMediaTailor Session Init Response:\033[0m"
    echo $SESSION_INIT_RESPONSE | jq

    mediaTailorManifestUrl=`echo $SESSION_INIT_RESPONSE | jq -r .manifestUrl`

    # Return playback URL
    echo -e "\033[1;30mPlayback URL:\033[0m \033[0;34mhttps://${CLOUDFRONT_HOSTNAME}${mediaTailorManifestUrl}\033[0m"
    return 0
}

sessionUrl="https://d2kzr1fexample.cloudfront.net/v1/session/64aeecfad278cEXAMPLEbb569fe792461EXAMPLE/LefGroup1/out/v1/LefGroup1/LefGroup1Event1/cmaf/index.m3u8"
streamType='hls-cmaf'
mediaTailorExplicitSessionInit $sessionUrl $streamType
```

**Example Output**:

```bash
MediaTailor Session URL: https://d2kzr1fexample.cloudfront.net/v1/session/64aeecfad278cEXAMPLEbb569fe792461EXAMPLE/LefGroup1/out/v1/LefGroup1/LefGroup1Event1/cmaf/index.m3u8
MediaTailor Stream Type: hls-cmaf
CloudFront Distribution Hostname: d2kzr1fexample.cloudfront.net
MediaTailor Session Init Response:
{
  "manifestUrl": "/v1/master/64aeecfad278cEXAMPLEbb569fe792461EXAMPLE/LefGroup1/out/v1/LefGroup1/LefGroup1Event1/cmaf/index.m3u8?aws.sessionId=4f0e823f-2f49-4001-8382-ffa96fa24bb1",
  "trackingUrl": "/v1/tracking/64aeecfad278cEXAMPLEbb569fe792461EXAMPLE/LefGroup1/4f0e823f-2f49-4001-8382-ffa96fa24bb1"
}
Playback URL: https://d2kzr1fexample.cloudfront.net/v1/master/64aeecfad278cEXAMPLEbb569fe792461EXAMPLE/LefGroup1/out/v1/LefGroup1/LefGroup1Event1/cmaf/index.m3u8?aws.sessionId=4f0e823f-2f49-4001-8382-ffa96fa24bb1
```

## Tools and Utilities

### MediaLive Scheduled Actions

Automate channel operations with scheduled actions.

**Location**: `tools/medialive-scheduled-actions/`

**Use Cases**:

- Scheduled channel start/stop
- Input switching at specific times
- Automated slate insertion
- Maintenance windows

**Documentation**: [MediaLive Scheduled Actions README](../tools/medialive-scheduled-actions/README.md)

### Encoding Profile Generator

Generate custom MediaLive encoding profiles.

**Location**: `tools/encoding-profile-generator/`

**Features**:

- Interactive profile creation
- Bitrate ladder optimization
- Resolution and framerate configuration
- Codec parameter tuning

**Documentation**: [Encoding Profile Generator README](../tools/encoding-profile-generator/README.md)

### Custom Transcode Profiles

Configure MediaTailor custom ad transcode profiles.

**Location**: `tools/custom-transcode-profiles/`

**Use Cases**:

- Precise ad/content alignment
- Premium content quality matching
- Playback device compatibility

**Documentation**: [Custom Transcode Profiles README](../tools/custom-transcode-profiles/README.md)

### MediaTailor Logger Role

Verify and create MediaTailor logging IAM role.

**Location**: `tools/mediatailor-logger-role/`

**Purpose**:

- Ensure MediaTailor can write to CloudWatch Logs
- Validate IAM role configuration
- Create role if missing

**Documentation**: [MediaTailor Logger README](../tools/mediatailor-logger-role/README.md)

## Cleanup

### Stop Channel

Use the provided script to stop your MediaLive channel:

```bash
./tools/stop_channel.sh
```

**Example Output**:

```bash
Stopping MediaLive Channel: 1234567
Channel 1234567 is not stopped
...
Channel 1234567 is stopped
```

**Important**: Ensure the MediaLive channel is in idle state before proceeding with stack deletion.

## Troubleshooting Testing Issues

### Common Test Failures

#### Channel Won't Start

- Check input source availability
- Verify input security group settings
- Review MediaLive channel configuration
- Check IAM permissions

#### URLs Return Errors

- Verify channel is running and outputting
- Check MediaPackage channel configuration
- Test origin URLs directly
- Review CloudFront distribution settings

#### Ad Insertion Not Working

- Verify MediaTailor configuration
- Check ad decision server availability
- Validate session initialization parameters
- Review MediaTailor logs (if enabled)

### Debug Commands

```bash
# Check channel status
aws medialive describe-channel --channel-id CHANNEL_ID

# Check MediaPackage channel
aws mediapackagev2 get-channel --channel-group-name GROUP --channel-name CHANNEL

# Check CloudFront distribution
aws cloudfront get-distribution --id DISTRIBUTION_ID

# Test connectivity
curl -v "$TEST_URL"
```

For additional troubleshooting, see the [Troubleshooting Guide](troubleshooting.md).
