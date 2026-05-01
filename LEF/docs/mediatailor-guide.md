# MediaTailor Guide

This guide covers MediaTailor session initialization, configuration, and advanced features in the Live Event Framework.

## MediaTailor Overview

MediaTailor provides server-side ad insertion (SSAI) capabilities, enabling personalized ad experiences in live streaming workflows.

### Key Benefits

- **Server-Side Stitching**: Seamless ad insertion without client-side complexity
- **Personalization**: Targeted ads based on viewer attributes
- **Analytics**: Comprehensive ad delivery and performance metrics
- **Scalability**: Cloud-native scaling for any audience size

## Session Initialization

MediaTailor supports two session initialization methods. The framework recommends **explicit session initialization** for security and flexibility.

### Explicit Session Initialization (Recommended)

#### Why Explicit is Recommended

1. **Security**: Targeting parameters not exposed to clients
2. **Flexibility**: Backend API controls session parameters
3. **Scalability**: CloudFront policies don't need modification for new parameters

#### Session Initialization Process

```bash
# POST to session initialization endpoint
curl -X POST "https://cloudfront-domain/v1/session/config-id/group/channel/manifest.m3u8" \
  -H "Content-Type: application/json" \
  -d '{
    "reportingMode": "SERVER",
    "playerParams": {
      "content_segment_prefix": "hls-cmaf",
      "ad_segment_prefix": "hls-cmaf"
    }
  }'
```

#### Response Format

```json
{
  "manifestUrl": "/v1/master/config-id/group/session-id/manifest.m3u8?aws.sessionId=session-id",
  "trackingUrl": "/v1/tracking/config-id/group/session-id"
}
```

#### Complete Example Function

```bash
function mediaTailorExplicitSessionInit() {
    sessionUrl=$1
    streamType=$2

    echo "MediaTailor Session URL: $sessionUrl"
    echo "MediaTailor Stream Type: $streamType"

    # Get CloudFront Hostname
    CLOUDFRONT_HOSTNAME=$(echo $sessionUrl | awk -F[/:] '{ print $4 }')
    echo "CloudFront Distribution Hostname: $CLOUDFRONT_HOSTNAME"

    # Initialize MediaTailor session
    SESSION_INIT_RESPONSE=$(curl --no-progress-meter -X POST "${sessionUrl}" -d "{
        \"reportingMode\": \"SERVER\",
        \"playerParams\": {
            \"content_segment_prefix\": \"${streamType}\",
            \"ad_segment_prefix\": \"${streamType}\"
        }
    }" 2>&1)

    # Check for errors
    if [ $? -ne 0 ]; then
        echo "Error: curl command failed"
        echo "$SESSION_INIT_RESPONSE"
        return 1
    fi

    echo "MediaTailor Session Init Response:"
    echo $SESSION_INIT_RESPONSE | jq

    mediaTailorManifestUrl=$(echo $SESSION_INIT_RESPONSE | jq -r .manifestUrl)

    # Return playback URL
    echo "Playback URL: https://${CLOUDFRONT_HOSTNAME}${mediaTailorManifestUrl}"
    return 0
}

# Usage example
sessionUrl="https://d2kzr1fexample.cloudfront.net/v1/session/config-id/group/channel/manifest.m3u8"
streamType='hls-cmaf'
mediaTailorExplicitSessionInit $sessionUrl $streamType
```

### Implicit Session Initialization

#### When to Use Implicit

- **Simple testing**: Quick testing without backend API
- **Legacy integration**: Existing systems using query parameters
- **Development**: Rapid prototyping and debugging

#### HLS Implicit Session Example

```bash
# GET request with query parameters
curl "https://cloudfront-domain/v1/master/config-id/group/channel/manifest.m3u8?playerParams.content_segment_prefix=hls-cmaf&playerParams.ad_segment_prefix=hls-cmaf"
```

**Response**: Multi-variant manifest with session ID embedded in variant URLs

```m3u8
#EXTM3U
#EXT-X-VERSION:6
#EXT-X-INDEPENDENT-SEGMENTS
#EXT-X-MEDIA:LANGUAGE="en",AUTOSELECT=YES,CHANNELS="2",FORCED=NO,TYPE=AUDIO,URI="../../../../../../../../manifest/config-id/group/session-id/7.m3u8",GROUP-ID="aac",DEFAULT=YES,NAME="English"
#EXT-X-STREAM-INF:CODECS="mp4a.40.2,avc1.64001F",AVERAGE-BANDWIDTH=3440800,RESOLUTION=960x540,VIDEO-RANGE=SDR,FRAME-RATE=50.0,BANDWIDTH=3968798,AUDIO="aac"
../../../../../../../../manifest/config-id/group/session-id/1.m3u8
```

#### DASH Implicit Session Example

```bash
# GET request returns 302 redirect with session ID
curl -v "https://cloudfront-domain/v1/dash/config-id/group/channel/manifest.mpd?playerParams.content_segment_prefix=dash-cmaf&playerParams.ad_segment_prefix=dash-cmaf"
```

**Response**: HTTP 302 redirect to URL with session ID

```
HTTP/2 302
location: /v1/dash/config-id/group/manifest.mpd?playerParams.content_segment_prefix=dash-cmaf&playerParams.ad_segment_prefix=dash-cmaf&aws.sessionId=session-id
```

## Required Dynamic Variables

The framework requires specific MediaTailor dynamic variables for proper operation.

### Mandatory Variables

#### content_segment_prefix

- **Purpose**: Defines CDN prefix for content segments
- **Values**: `hls-cmaf` or `dash-cmaf`
- **Usage**: Varies by stream type due to relative path differences

#### ad_segment_prefix

- **Purpose**: Defines CDN prefix for ad segments
- **Values**: `hls-cmaf` or `dash-cmaf`
- **Usage**: Must match content_segment_prefix for stream type

### Variable Configuration

Variables are configured in MediaTailor playback configuration:

```typescript
// Event Group Configuration
mediaTailor: [
  {
    name: "",
    contentSegmentUrlPrefix: "/",
    adSegmentUrlPrefix: "[INSERT_CLOUDFRONT_DOMAIN]",
    // Dynamic variables configured automatically
    playerParams: {
      content_segment_prefix: ["hls-cmaf", "dash-cmaf"],
      ad_segment_prefix: ["hls-cmaf", "dash-cmaf"],
    },
  },
];
```

### Stream Type Differences

#### HLS Streams

- **Segments relative to**: Variant manifest location
- **Path traversal**: Multiple `../` to reach distribution root
- **Prefix value**: `hls-cmaf`

#### DASH Streams

- **Segments relative to**: Main manifest location
- **Path traversal**: Fewer `../` to reach distribution root
- **Prefix value**: `dash-cmaf`

## Ad Insertion Modes

### STITCHED_ONLY (Default)

**How it works**: MediaTailor server-side stitches ads into content stream

**Benefits**:

- **Broad compatibility**: Works with any HLS/DASH player
- **Simplified client**: No ad-specific client logic required
- **Seamless experience**: No client-side ad transitions

**Use cases**:

- Standard live streaming
- Broad device compatibility required
- Simplified client implementation

**Configuration**:

```typescript
insertionMode: "STITCHED_ONLY";
```

### PLAYER_SELECT

**How it works**: Client chooses between content and ad segments

**Benefits**:

- **Enhanced features**: Client-side ad interaction capabilities
- **Flexible ad handling**: Custom ad logic in player
- **Advanced analytics**: Client-side ad event tracking

**Requirements**:

- **Ad-aware players**: Players must support client-side ad insertion
- **Custom integration**: Additional client-side implementation
- **Ad tracking**: Client must implement ad event reporting

**Use cases**:

- Interactive ad experiences
- Custom ad logic requirements
- Advanced analytics needs

**Configuration**:

```typescript
insertionMode: "PLAYER_SELECT";
```

## Event-Level MediaTailor Configuration

### When to Use Event-Level Configuration

- **Different ad servers**: Per-event ad decision servers
- **A/B testing**: Multiple configurations for testing
- **Custom targeting**: Event-specific targeting parameters
- **Mixed insertion modes**: Different modes per event
- **Enhanced observability**: Granular metrics per configuration

### Configuration Structure

```typescript
// config/default/eventAdvancedConfiguration.ts
export const EVENT_CONFIG: IEventConfig = {
  event: {
    // Standard MediaLive and MediaPackage configuration
    mediaLive: {
      /* ... */
    },
    mediaPackage: {
      /* ... */
    },

    // Event-specific MediaTailor configurations
    mediaTailor: [
      {
        name: "", // Primary configuration (empty name)
        adDecisionServerUrl: "https://primary-ads.example.com/ads",
        contentSegmentUrlPrefix: "/",
        adSegmentUrlPrefix: "[INSERT_CLOUDFRONT_DOMAIN]",
        insertionMode: "STITCHED_ONLY",
        logPercentageEnabled: 10,
        slateAdUrl: "https://example.com/slate.mp4",
      },
      {
        name: "test", // Secondary configuration for A/B testing
        adDecisionServerUrl: "https://test-ads.example.com/ads",
        contentSegmentUrlPrefix: "/",
        adSegmentUrlPrefix: "[INSERT_CLOUDFRONT_DOMAIN]",
        insertionMode: "PLAYER_SELECT",
        logPercentageEnabled: 100,
        slateAdUrl: "https://example.com/test-slate.mp4",
      },
    ],
  },
};
```

### Configuration Precedence

1. **Event-specific configurations**: Used for manifest URL construction
2. **Event group configurations**: Remain accessible via original URLs
3. **Primary configuration**: First in array used for default outputs
4. **Named configurations**: Create individual CloudFormation outputs

### Deployment with Event-Level Configuration

```bash
npx cdk deploy LefEventStack \
  --context eventStackName=LefGroup1Event1 \
  --context eventGroupStackName=LefGroup1 \
  --context eventConfigFile=../../config/default/eventAdvancedConfiguration.ts
```

## Logging Configuration

### Log Percentage Settings

Configure logging percentage to balance observability with cost:

```typescript
mediaTailor: [
  {
    name: "",
    logPercentageEnabled: 10, // 0-100
    // ... other configuration
  },
];
```

### Recommended Settings

| Environment     | Percentage | Rationale                      |
| --------------- | ---------- | ------------------------------ |
| **Development** | 100%       | Full debugging capability      |
| **Staging**     | 50%        | Balanced testing and cost      |
| **Production**  | 10%        | Cost-optimized with visibility |
| **High-Volume** | 5%         | Minimal cost impact            |

### Cost Optimization

#### Production Optimization

- **Default 10%**: Provides adequate visibility
- **Significant savings**: ~90% reduction in log costs
- **Debug capability**: Individual sessions can still use 100% logging

#### Debug Individual Sessions

```bash
# Add to session initialization for full logging
{
  "reportingMode": "SERVER",
  "playerParams": {
    "content_segment_prefix": "hls-cmaf",
    "ad_segment_prefix": "hls-cmaf",
    "aws.logMode": "DEBUG"
  }
}
```

### Log Analysis

#### CloudWatch Logs Location

- **Log Group**: `/aws/mediatailor/PlaybackConfiguration/{configuration-name}`
- **Log Streams**: Organized by date and configuration

#### Key Log Events

- **Session initialization**: Session creation and parameters
- **Ad requests**: Requests to ad decision server
- **Ad responses**: Ad decision server responses
- **Segment requests**: Content and ad segment requests
- **Tracking events**: Ad impression and completion tracking

## Ad Decision Server Integration

### ADS Requirements

#### Request Format

MediaTailor sends VAST-compliant requests to your ad decision server:

```
GET https://your-ads.example.com/ads?
  correlator=[CACHE_BUSTER]&
  cust_params=[PLAYER_PARAMS]&
  description_url=[CONTENT_URL]&
  duration=[AVAIL_DURATION]&
  iu=[AD_UNIT_ID]&
  output=vast&
  sz=[PLAYER_SIZE]&
  unviewed_position_start=1&
  url=[CONTENT_URL]
```

#### Response Format

ADS must return valid VAST 2.0, 3.0, or 4.0 XML:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<VAST version="3.0">
  <Ad id="ad1">
    <InLine>
      <AdSystem>Your Ad System</AdSystem>
      <AdTitle>Sample Ad</AdTitle>
      <Creatives>
        <Creative>
          <Linear>
            <Duration>00:00:30</Duration>
            <MediaFiles>
              <MediaFile delivery="progressive" type="video/mp4" width="1920" height="1080">
                <![CDATA[https://example.com/ad-creative.mp4]]>
              </MediaFile>
            </MediaFiles>
            <TrackingEvents>
              <Tracking event="start">
                <![CDATA[https://example.com/tracking/start]]>
              </Tracking>
              <Tracking event="complete">
                <![CDATA[https://example.com/tracking/complete]]>
              </Tracking>
            </TrackingEvents>
          </Linear>
        </Creative>
      </Creatives>
    </InLine>
  </Ad>
</VAST>
```

### Testing ADS Integration

#### Manual ADS Testing

```bash
# Test ADS directly
curl "https://your-ads.example.com/ads?correlator=12345&output=vast"

# Validate VAST response
xmllint --format response.xml
```

#### MediaTailor ADS Testing

```bash
# Initialize session with ADS
curl -X POST "SESSION_URL" -d '{
  "reportingMode": "SERVER",
  "playerParams": {
    "content_segment_prefix": "hls-cmaf",
    "ad_segment_prefix": "hls-cmaf",
    "custom_param": "test_value"
  }
}'
```

## Advanced Features

### Custom Transcode Profiles

For precise ad/content alignment, configure custom transcode profiles.

**Use cases**:

- **Premium content**: Exact quality matching required
- **Device compatibility**: Specific device requirements
- **Playback issues**: Problems during ad transitions

**Setup**: See [Custom Transcode Profiles Guide](../tools/custom-transcode-profiles/README.md)

### Slate Ad Configuration

Configure slate ads for ad breaks without available ads:

```typescript
mediaTailor: [
  {
    name: "",
    slateAdUrl: "https://example.com/slate-ad.mp4",
    // ... other configuration
  },
];
```

### Personalization Parameters

Pass targeting parameters for personalized ads:

```bash
# Session initialization with targeting
curl -X POST "SESSION_URL" -d '{
  "reportingMode": "SERVER",
  "playerParams": {
    "content_segment_prefix": "hls-cmaf",
    "ad_segment_prefix": "hls-cmaf",
    "viewer_id": "user123",
    "content_genre": "sports",
    "device_type": "mobile"
  }
}'
```

### Server-Side Reporting

The framework uses server-side reporting by default:

**Benefits**:

- **Automatic tracking**: MediaTailor reports ad events automatically
- **Simplified client**: No client-side tracking implementation required
- **Reliable reporting**: Server-side ensures accurate reporting

**How it works**:

1. MediaTailor intercepts segment requests
2. Automatically fires tracking pixels for ad events
3. Reports impression, start, complete, and other events

## Troubleshooting MediaTailor

### Common Issues

#### Session Initialization Fails

- **Check required parameters**: Ensure `content_segment_prefix` and `ad_segment_prefix` are set
- **Validate ADS**: Test ad decision server directly
- **Check configuration**: Verify MediaTailor configuration is correct

#### Ads Not Inserting

- **ADS availability**: Verify ad decision server is returning ads
- **VAST validation**: Ensure VAST response is valid
- **Network connectivity**: Check MediaTailor can reach ADS

#### Playback Issues

- **Ad creative format**: Ensure ad creatives match content format
- **Transcode profiles**: Consider custom transcode profiles
- **Player compatibility**: Verify player supports MediaTailor features

### Debug Commands

```bash
# Check MediaTailor configuration
aws mediatailor get-playback-configuration --name CONFIG_NAME

# List MediaTailor configurations
aws mediatailor list-playback-configurations

# Check CloudWatch logs (if enabled)
aws logs describe-log-groups --log-group-name-prefix /aws/mediatailor
```

For additional troubleshooting, see the [Troubleshooting Guide](troubleshooting.md).
