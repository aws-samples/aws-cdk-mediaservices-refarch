# Configuration Guide

This guide covers advanced configuration options for the Live Event Framework.

## Configuration File Structure

### Default Configuration Locations

- **Foundation**: `config/default/foundationConfiguration.ts`
- **Event Group**: `config/default/eventGroupConfiguration.ts`
- **Event**: `config/default/eventConfiguration.ts`
- **Event Advanced**: `config/default/eventAdvancedConfiguration.ts`

### Low-Latency Configurations

Pre-configured for low-latency streaming:

- **Foundation**: `config/low-latency/foundationConfiguration.ts`
- **Event Group**: `config/low-latency/eventGroupConfiguration.ts`
- **Event**: `config/low-latency/eventConfiguration.ts`

## MediaTailor Configuration

### Log Percentage Configuration

Configure MediaTailor logging percentage in event group configuration:

```typescript
mediaTailor: [
  {
    name: "",
    adDecisionServerUrl: "https://your-ad-server.com/ads",
    logPercentageEnabled: 10, // Valid values: 0-100
    // ... other configuration
  },
];
```

#### Recommended Values

| Environment                | Percentage | Use Case                       |
| -------------------------- | ---------- | ------------------------------ |
| **Development/Testing**    | 100%       | Full logging for debugging     |
| **Production**             | 10%        | Cost-optimized with visibility |
| **High-Volume Production** | 5%         | Minimal cost impact            |

#### Cost Impact

- **100% logging**: Full CloudWatch costs for all sessions
- **10% logging**: ~90% reduction in CloudWatch log costs
- **5% logging**: ~95% reduction in CloudWatch log costs

#### Debug Individual Sessions

Regardless of global percentage, individual sessions can be fully logged:

```bash
# Add to session initialization
aws.logMode=DEBUG
```

### Event-Level MediaTailor Configuration

Events can define their own MediaTailor configurations for advanced scenarios.

#### Configuration File: `eventAdvancedConfiguration.ts`

```typescript
export const EVENT_CONFIG: IEventConfig = {
  event: {
    // ... standard mediaLive and mediaPackage configuration
    mediaTailor: [
      {
        name: "", // Primary configuration (empty name)
        adDecisionServerUrl: "https://your-ad-server.com/ads",
        contentSegmentUrlPrefix: "/",
        adSegmentUrlPrefix: "[INSERT_CLOUDFRONT_DOMAIN]",
        insertionMode: "STITCHED_ONLY",
        logPercentageEnabled: 10,
      },
      {
        name: "test", // Secondary configuration for A/B testing
        adDecisionServerUrl: "https://test-ad-server.com/ads",
        contentSegmentUrlPrefix: "/",
        adSegmentUrlPrefix: "[INSERT_CLOUDFRONT_DOMAIN]",
        insertionMode: "PLAYER_SELECT",
        logPercentageEnabled: 100,
      },
    ],
  },
};
```

#### Key Features

- **Multiple Configurations**: Support multiple MediaTailor configurations per event
- **Primary Configuration**: First configuration (empty name) used for default outputs
- **Named Configurations**: Create separate CloudFormation outputs
- **URL Precedence**: Event configurations override event group for manifest URLs
- **Backward Compatibility**: Events without MediaTailor config use event group defaults

#### Deployment with Event-Level MediaTailor

```bash
npx cdk deploy LefEventStack \
  --context eventStackName=LefGroup1Event1 \
  --context eventGroupStackName=LefGroup1 \
  --context eventConfigFile=../../config/default/eventAdvancedConfiguration.ts
```

#### Use Cases

- **Different Ad Servers**: Per-event ad decision servers
- **A/B Testing**: Multiple configurations for testing
- **Insertion Modes**: Mix of STITCHED_ONLY and PLAYER_SELECT
- **Custom Targeting**: Event-specific targeting parameters
- **Enhanced Observability**: Granular metrics per configuration

### Ad Insertion Modes

#### STITCHED_ONLY (Default)

- **Server-side insertion**: MediaTailor stitches ads into content
- **Broader compatibility**: Works with most players
- **Simplified client**: No client-side ad handling required

#### PLAYER_SELECT

- **Client-side control**: Player chooses between content and ad segments
- **Enhanced features**: Client-side ad tracking and interaction
- **Player requirements**: Requires ad-aware video players

```typescript
insertionMode: "PLAYER_SELECT"; // or "STITCHED_ONLY"
```

## MediaPackage V2 Access Logging

MediaPackage V2 access logging captures detailed request information with multiple destination options.

### Enabling Access Logging

Modify event group configuration file:

```typescript
mediaPackageLogging: {
  enabled: true, // Set to true to enable logging
  egressAccessLogs: [
    {
      destinationType: "CLOUDWATCH_LOGS",
      retentionInDays: 30,
      outputFormat: "json",
    },
  ],
  ingressAccessLogs: [
    {
      destinationType: "CLOUDWATCH_LOGS",
      retentionInDays: 30,
      outputFormat: "json",
    },
  ],
}
```

### Destination Types

#### CloudWatch Logs (Default)

```typescript
{
  destinationType: "CLOUDWATCH_LOGS",
  retentionInDays: 30,
  outputFormat: "json",
  // Optional: custom log group name
  // logGroupName: "/custom/log/group/name"
}
```

**Default Log Group Names**:

- Egress: `/aws/mediapackagev2/{channelGroupName}/egressAccessLogs`
- Ingress: `/aws/mediapackagev2/{channelGroupName}/ingressAccessLogs`

#### Amazon S3

```typescript
{
  destinationType: "S3",
  destinationArn: "arn:aws:s3:::my-mediapackage-logs-bucket",
  outputFormat: "json",
  s3Suffix: "year={yyyy}/month={MM}/day={dd}/hour={HH}",
  hiveCompatible: true,
}
```

#### Amazon Data Firehose

```typescript
{
  destinationType: "FIREHOSE",
  destinationArn: "arn:aws:firehose:us-east-1:123456789012:deliverystream/my-stream",
  outputFormat: "json",
}
```

### IAM Permissions

The framework automatically creates necessary IAM permissions:

- **CloudWatch Logs**: `logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:PutLogEvents`
- **S3**: `s3:PutObject`, `s3:GetBucketAcl`
- **Data Firehose**: `firehose:PutRecord`, `firehose:PutRecordBatch`

### Cost Considerations

⚠️ **Important**: MediaPackage access logging uses CloudWatch vended logs with additional charges.

#### Cost Optimization Tips

- **Development**: Enable logging for debugging
- **Production**: Evaluate logging requirements vs. costs
- **Retention**: Use shorter retention periods for high-volume logs
- **S3 Lifecycle**: Implement lifecycle policies for long-term archival
- **Monitoring**: Track CloudWatch vended log charges in Cost Explorer

## Secure Media Delivery at the Edge

### Integration Setup

The framework is compatible with [Secure Media Delivery at the Edge](https://aws.amazon.com/solutions/implementations/secure-media-delivery-at-the-edge/) solution.

#### Enable on Event Group

Set the tokenization function ARN in event group configuration:

```typescript
eventGroup: {
  cloudFront: {
    tokenizationFunctionArn: "arn:aws:lambda:region:account:function:CheckTokenFunction";
  }
}
```

#### MediaTailor Configuration

When using Secure Media Delivery at the Edge, configure MediaTailor prefixes:

- **Content Segment Prefix**: `[player_params.content_segment_prefix]`
- **Ad Segment Prefix**: `[player_params.ad_segment_prefix]`

### Benefits

- **Content Protection**: Token-based access control
- **DRM Integration**: Works with DRM solutions
- **Cost Effective**: Reasonable cost for significant security enhancement
- **Edge Enforcement**: Protection at CloudFront edge locations

## MediaLive Encoding Profiles

### Default Profile

Default configuration uses: `encoding-profiles/hd-avc-50fps-sample/medialive-hls-ts-v1.json`

### Custom Encoding Profiles

#### Option 1: Encoding Profile Generator

Use the [Encoding Profile Generator](../tools/encoding-profile-generator/README.md) tool:

```bash
cd tools/encoding-profile-generator
# Follow tool instructions to generate custom profiles
```

#### Option 2: Manual Profile Creation

1. Copy existing profile:

   ```bash
   cp encoding-profiles/hd-avc-50fps-sample/medialive-hls-ts-v1.json \
      encoding-profiles/my-custom-profile/medialive-custom.json
   ```

2. Modify profile parameters as needed

3. Update event configuration to reference new profile:
   ```typescript
   mediaLive: {
     encodingProfile: "encoding-profiles/my-custom-profile/medialive-custom.json";
   }
   ```

### Profile Considerations

- **Bitrate Ladder**: Optimize for your content and audience
- **Resolution/Framerate**: Match source content characteristics
- **Codec Settings**: Balance quality vs. bandwidth requirements
- **Audio Configuration**: Ensure appropriate audio encoding settings

## MediaTailor Custom Transcode Profiles

For precise ad transcoding alignment with live streams.

### When to Use

- **Playback Issues**: Devices experiencing problems during ad transitions
- **Quality Matching**: Need precise alignment between content and ad transcodes
- **Premium Content**: High-quality content requiring exact matching

### Setup

See [Custom Transcode Profiles README](../tools/custom-transcode-profiles/README.md) for detailed instructions.

## MediaLive Anywhere Configuration

For on-premises encoding with cloud delivery.

### Use Cases

- **SMPTE 2110**: Professional broadcast environments
- **On-Premises Control**: Keep encoding on-premises
- **Hybrid Workflows**: Mix of cloud and on-premises resources

### Setup

See [MediaLive Anywhere README](../tools/medialive-anywhere/README.md) for configuration instructions.

## Elemental Live Appliances

For hardware-based encoding integration.

### Use Cases

- **Existing Hardware**: Leverage existing Elemental Live appliances
- **Dedicated Hardware**: Hardware-based encoding requirements
- **Migration**: Gradual migration from appliances to cloud

### Setup

See [Elemental Live README](../tools/elemental-live/README.md) for integration instructions.

## Multiple Input Configuration

### Input Switching Support

Configure multiple inputs for redundancy and switching:

```typescript
inputs: [
  {
    name: "primary",
    type: "RTMP_PUSH",
    // ... input configuration
  },
  {
    name: "backup",
    type: "RTMP_PUSH",
    // ... input configuration
  },
];
```

### MediaPackage Preferred Input

For CMAF inputs, configure preferred input:

```typescript
mediaPackage: {
  inputSwitchConfiguration: {
    preferredInput: 1; // Prefer first input when both available
  }
}
```

### Benefits

- **Redundancy**: Primary/backup input configurations
- **Content Switching**: Switch between different content sources
- **Reliability**: Automatic failover capabilities

## CloudFront Configuration

### Origin Shield

Enable for high-traffic deployments:

```typescript
cloudFront: {
  originShield: {
    enabled: true,
    region: "us-east-1" // Choose appropriate region
  }
}
```

### Access Logging

Configure CloudFront access logging:

```typescript
cloudFront: {
  accessLogging: {
    enabled: true,
    bucket: "my-cloudfront-logs-bucket",
    prefix: "access-logs/"
  }
}
```

### Cache Behaviors

Customize caching behavior:

```typescript
cloudFront: {
  cacheBehaviors: [
    {
      pathPattern: "*.m3u8",
      cachePolicyId: "custom-manifest-policy",
      ttl: {
        default: 1,
        max: 1,
      },
    },
  ];
}
```

## Environment-Specific Configurations

### Development Environment

```typescript
// Optimized for development and testing
{
  mediaTailor: {
    logPercentageEnabled: 100 // Full logging
  },
  mediaPackageLogging: {
    enabled: true // Enable for debugging
  },
  cloudFront: {
    accessLogging: {
      enabled: false // Reduce costs
    }
  }
}
```

### Production Environment

```typescript
// Optimized for production
{
  mediaTailor: {
    logPercentageEnabled: 10 // Cost-optimized logging
  },
  mediaPackageLogging: {
    enabled: false // Disable unless needed
  },
  cloudFront: {
    originShield: {
      enabled: true // Enable for scale
    },
    accessLogging: {
      enabled: true // Enable for analytics
    }
  }
}
```

## Configuration Validation

### Pre-Deployment Validation

1. **Syntax Check**: Validate TypeScript configuration files
2. **Parameter Validation**: Ensure required parameters are set
3. **Resource Limits**: Check against AWS service quotas
4. **Dependencies**: Verify stack dependencies are correct

### Post-Deployment Validation

1. **Resource Creation**: Verify all resources created successfully
2. **Configuration Applied**: Check resource configurations match expectations
3. **Connectivity**: Test end-to-end connectivity
4. **Monitoring**: Verify monitoring and logging are working

## Troubleshooting Configuration Issues

### Common Configuration Problems

- **Invalid Parameters**: Check parameter types and valid values
- **Missing Dependencies**: Ensure dependent resources exist
- **Service Limits**: Verify quotas are sufficient
- **IAM Permissions**: Check service roles have required permissions

### Debugging Steps

1. **Check CloudFormation Events**: Review stack events for errors
2. **Validate Configuration**: Use CDK synth to check generated templates
3. **Test Incrementally**: Deploy and test one stack at a time
4. **Review Logs**: Check CloudWatch logs for service-specific errors

For additional troubleshooting, see the [Troubleshooting Guide](troubleshooting.md).
