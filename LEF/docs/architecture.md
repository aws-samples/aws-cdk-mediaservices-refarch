# Architecture Guide

This guide provides detailed information about the Live Event Framework architecture, design decisions, and service considerations.

## Architecture Overview

The Live Event Framework uses a **3-stack architecture** designed for scalability, cost optimization, and operational flexibility.

### Stack Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Foundation Stack                         │
│  • IAM Roles & Policies        • S3 Logging Bucket          │
│  • CloudFront Policies         • SNS Topic                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Event Group Stack                        │
│  • MediaPackage Channel Group  • CloudFront Distribution    │
│  • MediaTailor Configurations  • Access Logging             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        Event Stack                          │
│  • MediaLive Channel           • MediaPackage Channel       │
│  • MediaLive Input(s)          • Optional MediaTailor       │
└─────────────────────────────────────────────────────────────┘
```

### Resource Distribution

| Stack           | Resources                                           | Purpose                                        |
| --------------- | --------------------------------------------------- | ---------------------------------------------- |
| **Foundation**  | IAM, S3, SNS, CloudFront Policies                   | Shared resources across all channels in region |
| **Event Group** | MediaPackage Channel Group, CloudFront, MediaTailor | Shared resources for related channels          |
| **Event**       | MediaLive Channel, MediaPackage Channel             | Individual channel resources                   |

## Deployment Modes

### Standard Architecture (Recommended)

- **Event Group MediaTailor**: Shared MediaTailor configurations across all events in group
- **Simplified Management**: Common ad insertion settings for related channels
- **Cost Effective**: Shared CloudFront distribution and MediaTailor configurations

### Advanced Architecture

- **Event-Level MediaTailor**: Individual events can define additional MediaTailor configurations
- **Per-Event Customization**: Different ad servers, insertion modes, targeting per event
- **A/B Testing**: Multiple MediaTailor configurations per event
- **Enhanced Observability**: Granular metrics per configuration

## Key Architecture Decisions

### 1. CloudFront-Centric Design

**Decision**: All player interactions go through CloudFront Distribution

**Benefits**:

- Consistent CORS policy via single response header policy
- Compatible with [Secure Media Delivery at the Edge](https://aws.amazon.com/solutions/implementations/secure-media-delivery-at-the-edge/)
- Optional AWS WAF integration for additional security
- Global content delivery with edge caching

**Implications**:

- Many URLs returned to players are relative URLs (using '..' notation)
- All manifest, segment, and tracking requests flow through CloudFront

### 2. MediaPackage V2 Format Support

**Decision**: Support only HLS/CMAF and DASH/CMAF (not HLS/TS)

**Rationale**:

- HLS/TS is largely legacy format
- CMAF container more efficient than TS (lower delivery costs)
- HLS/CMAF and DASH/CMAF can share segments (better cache hit ratios)
- Reduced complexity without significant functionality loss

### 3. MediaTailor Session Initialization

**Decision**: Recommend explicit session initialization over implicit

**Benefits**:

- Backend API can initialize sessions without exposing targeting parameters to clients
- More secure - sensitive targeting information not exposed to viewers
- CloudFront policies don't need modification for new targeting parameters

**Implementation**: Framework supports both explicit and implicit for flexibility

### 4. Server-Side Ad Reporting

**Decision**: Use server-side reporting by default

**Benefits**:

- Minimizes client-side integration complexity
- MediaTailor reports ad consumption directly to tracking URLs
- Automatic reporting when media segments are requested

**Alternative**: Client-side reporting supported but requires additional client implementation

### 5. Multiple Input Support

**Decision**: Support multiple MediaLive inputs per channel

**Benefits**:

- Input switching capabilities (primary/backup streams)
- Content source switching
- Enhanced reliability and flexibility

**Configuration**: Multiple inputs configured via `inputs` array in event configuration

### 6. MediaPackage Preferred Input

**Decision**: Support preferred input configuration for CMAF inputs

**Benefits**:

- MediaPackage favors specified input when both available
- Improved failover behavior
- Better control over input selection

**Configuration**: Set via `inputSwitchConfiguration.preferredInput` (defaults to input 1)

### 7. CloudFront Origin Shield

**Decision**: Disabled by default

**Rationale**:

- Additional charges incurred when enabled
- Provides significant benefits at scale (load reduction, availability, cost savings)
- Can be enabled when operating at scale

**Recommendation**: Enable for production deployments with significant traffic

### 8. Access Logging

**Decision**: CloudFront standard access logs enabled by default, MediaPackage logs disabled

**Rationale**:

- CloudFront logs provide valuable insights with reasonable cost
- MediaPackage logs use CloudWatch vended logs (higher cost)
- MediaPackage logging can be enabled when needed for debugging

## Service Limits and Quotas

### Critical Limits to Monitor

#### MediaPackage V2

- **Channel Groups**: Default limit varies by region
- **Channels per Channel Group**: Default 10 (can be increased)
- **Origin Endpoints per Channel**: Default 10

#### MediaLive

- **Channels**: Default 5 (can be increased significantly)
- **Push Inputs**: Default 20
- **Input Security Groups**: Default 5 (if using push inputs with security groups)
- **HEVC Channels**: Separate quota if using HEVC encoding
- **UHD Channels**: Separate quota for 4K content

#### CloudFront

- **Query Strings per Origin Request Policy**: Default 10
- **Distributions**: Default 200
- **Origins per Distribution**: Default 25

### Requesting Limit Increases

1. Navigate to [Service Quotas Console](https://console.aws.amazon.com/servicequotas/home)
2. Search for the specific service (MediaLive, MediaPackage, etc.)
3. Select the quota to increase
4. Request quota increase with business justification
5. Monitor request status and approval

### Planning for Scale

- **Single Event Group**: Suitable for 2-5 channels
- **Multiple Event Groups**: Required for larger deployments
- **Regional Distribution**: Consider multiple regions for global content
- **Service Limit Buffer**: Request increases before reaching limits

## Cost Considerations

### Cost Optimization Strategies

#### Resource Sharing

- **Foundation Stack**: Share IAM roles, policies, S3 buckets across all channels
- **Event Group**: Share CloudFront distribution and MediaTailor configs across related channels
- **MediaPackage**: Use shared channel groups for related content

#### Logging Optimization

- **MediaTailor Logging**: Use 10% or less for production (default configurations)
- **MediaPackage Logging**: Enable only when needed for debugging
- **CloudFront Logging**: Consider disabling if not needed to reduce S3 costs

#### Encoding Optimization

- **Adaptive Bitrate Ladder**: Optimize encoding profiles for your content
- **QVBR Rate Control**: Use quality-defined variable bitrate for bandwidth savings
- **Resolution/Framerate**: Match encoding settings to content requirements

### Cost Allocation Tags

The framework automatically applies tags for cost tracking:

- **LefChannel**: Individual channel identification
- **LefChannelGroup**: Channel group identification
- **LefOriginEndpoint**: Origin endpoint identification

**Manual Activation Required**: Tags must be manually activated in AWS Billing Console for cost allocation.

#### Activating Cost Allocation Tags

1. Deploy LEF resources first
2. Open [AWS Billing Console](https://console.aws.amazon.com/billing/home#/tags)
3. Navigate to 'Cost allocation tags'
4. Find and activate LEF tags in 'User-defined cost allocation tags'
5. Wait up to 24 hours for tags to appear in billing reports

#### Using Cost Allocation Tags

- **AWS Cost Explorer**: Filter and group costs by LEF resources
- **AWS Budgets**: Create budgets based on LEF resource usage
- **Cost and Usage Reports**: Include LEF tag columns in detailed reports

### Reserved Capacity

For 24/7 workflows, consider:

- **MediaLive Reserved Inputs**: Significant cost savings for continuous operation
- **CloudFront Reserved Capacity**: Available for high-volume distributions
- **EC2 Reserved Instances**: If using custom origins or processing

## Security Considerations

### Content Protection

#### Secure Media Delivery at the Edge

- **Highly Recommended**: Deploy alongside LEF for content protection
- **Token-Based Access**: Control content access via signed URLs/cookies
- **DRM Integration**: Works with DRM solutions for premium content
- **Cost**: Additional charges apply but provides significant security value

#### Content Encryption

- **MediaPackage Encryption**: Support for AES-128 and SAMPLE-AES
- **DRM Integration**: SPEKE integration for Widevine, PlayReady, FairPlay
- **Key Management**: Integration with AWS KMS for key management

### Network Security

#### VPC Integration

- **MediaLive VPC**: Deploy MediaLive in VPC for private networking
- **Private Subnets**: Use private subnets for MediaLive channels
- **Security Groups**: Control network access to MediaLive inputs

#### Access Control

- **IAM Roles**: Principle of least privilege for service roles
- **CloudFront Policies**: Restrict access via origin request/response policies
- **WAF Integration**: Optional AWS WAF for additional protection

## Monitoring and Observability

### CloudWatch Metrics

#### MediaLive Metrics

- **Input Video/Audio**: Monitor input health and quality
- **Channel State**: Track channel start/stop events
- **Output Health**: Monitor output delivery success
- **Error Rates**: Track encoding and delivery errors

#### MediaPackage Metrics

- **Origin Requests**: Monitor origin load and performance
- **Egress Bytes**: Track content delivery volume
- **Error Rates**: Monitor packaging and delivery errors

#### CloudFront Metrics

- **Cache Hit Ratio**: Monitor CDN efficiency
- **Origin Load**: Track requests to MediaPackage origins
- **Error Rates**: Monitor 4xx/5xx error rates
- **Geographic Distribution**: Understand viewer distribution

### Logging Strategy

#### Production Logging Recommendations

- **MediaTailor**: 10% logging for cost optimization
- **MediaPackage**: Enable only for debugging (high cost)
- **CloudFront**: Standard access logs for analytics
- **Application Logs**: Custom application logging for business metrics

#### Development/Testing Logging

- **MediaTailor**: 100% logging for full debugging
- **MediaPackage**: Enable for detailed request analysis
- **Debug Sessions**: Use `aws.logMode=DEBUG` for individual session debugging

## Scalability Patterns

### Horizontal Scaling

#### Multiple Event Groups

- **Content Segmentation**: Group related channels by content type, region, or business unit
- **Configuration Isolation**: Different MediaTailor, CloudFront settings per group
- **Operational Isolation**: Independent deployment and management

#### Regional Distribution

- **Multi-Region Deployment**: Deploy in multiple AWS regions for global reach
- **Content Localization**: Region-specific content and ad insertion
- **Disaster Recovery**: Cross-region backup and failover capabilities

### Vertical Scaling

#### Channel Optimization

- **Encoding Profiles**: Optimize bitrate ladders for content and audience
- **Segment Duration**: Balance latency vs. efficiency requirements
- **Input Redundancy**: Multiple inputs for reliability

#### Performance Optimization

- **CloudFront Optimization**: Origin Shield, caching policies, compression
- **MediaPackage Optimization**: Segment combining, preferred inputs
- **MediaTailor Optimization**: Custom transcode profiles, session management

## Integration Patterns

### Upstream Integration

#### Content Sources

- **Live Encoders**: On-premises encoders via RTMP/SRT
- **MediaLive Anywhere**: On-premises MediaLive for SMPTE 2110
- **Elemental Live**: Hardware appliances integration
- **Third-Party Encoders**: Any encoder supporting RTMP/SRT output

#### Content Management

- **Scheduling Systems**: Integration with broadcast scheduling
- **Asset Management**: Integration with content management systems
- **Workflow Orchestration**: Integration with media workflow systems

### Downstream Integration

#### Player Integration

- **HLS Players**: Native iOS, Android, web players
- **DASH Players**: DASH.js, ExoPlayer, other DASH-compatible players
- **Ad Integration**: Client-side ad SDK integration for enhanced features

#### Analytics Integration

- **Real-Time Analytics**: CloudWatch metrics and custom metrics
- **Business Analytics**: Integration with analytics platforms
- **Quality Monitoring**: Video quality and viewer experience monitoring

## Best Practices

### Deployment Best Practices

1. **Start Small**: Begin with single event group and scale as needed
2. **Test Thoroughly**: Validate each deployment with actual content
3. **Monitor Limits**: Track service quotas and request increases proactively
4. **Document Configuration**: Maintain configuration documentation for operational teams

### Operational Best Practices

1. **Monitoring**: Implement comprehensive monitoring and alerting
2. **Backup**: Regular backup of configuration and critical data
3. **Security**: Regular security reviews and updates
4. **Cost Management**: Regular cost analysis and optimization

### Development Best Practices

1. **Version Control**: Track configuration changes in version control
2. **Testing**: Automated testing of deployments and configurations
3. **Documentation**: Maintain up-to-date documentation
4. **Change Management**: Controlled change processes for production environments
