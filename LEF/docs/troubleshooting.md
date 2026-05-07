# Troubleshooting Guide

This guide covers common issues, solutions, and cleanup procedures for the Live Event Framework.

## Known Issues

### Configuration Limitations

#### 1. MediaPackage I-Frame Only Streams

**Issue**: Default event configuration sets `includeIframeOnlyStreams: false`

**Expected**: Should be `true` for optimal trick-play support

**Workaround**: Value disabled due to MediaTailor Dynamic DASH ad transcoding issue

**Resolution**: Will be changed back to `true` once underlying issue is resolved

#### 2. Segment Length Configuration

**Issue**: `segmentLengthInSeconds` set to 4 seconds instead of optimal 2 seconds

**Impact**: Less granular segment harvesting capabilities

**Cause**: Avoids MediaPackage V2 segment combining logic issue

**Resolution**: Will be changed back to 2 seconds once issue is addressed

#### 3. MediaTailor Content Source Configuration

**Issue**: Event Groups configure MediaTailor to use CloudFront as content source

**Impact**: Additional configuration required for tokenization solutions

**Workaround**: Most scalable architecture but requires specific tokenization setup

**Solution**: Follow [Secure Media Delivery configuration](configuration.md#secure-media-delivery-at-the-edge)

## Common Deployment Issues

### Email Subscription Not Confirmed

**Symptoms**:

- Event Group stack deployment fails
- Error message about SNS subscription

**Cause**: SNS email subscription not confirmed before Event Group deployment

**Solution**:

1. Check email (including spam folder)
2. Click "Confirm subscription" link
3. Wait for confirmation page
4. Retry Event Group deployment

**Prevention**: When using Option A (deploy all), confirm email after deployment completes

### Stack Name Conflicts

**Symptoms**:

- Deployment fails with "already exists" error
- CloudFormation shows stack name conflicts

**Cause**: Attempting to deploy with existing stack name

**Solution**:

1. Use unique stack names with appropriate context parameter:

   ```bash
   # For Foundation stack
   --context foundationStackName=UniqueFoundationName

   # For Event Group stack
   --context eventGroupStackName=UniqueGroupName --context foundationStackName=FoundationName

   # For Event stack
   --context eventStackName=UniqueEventName --context eventGroupStackName=GroupName
   ```

2. Or delete existing stack first (if safe to do so)

**Prevention**: Use descriptive, unique stack names for each deployment

### Service Limit Exceeded

**Symptoms**:

- Deployment fails with quota/limit errors
- Error messages mentioning service limits

**Common Limits**:

- MediaLive Channels (default: 5)
- MediaPackage Channels per Channel Group (default: 10)
- CloudFront Query Strings per Policy (default: 10)

**Solution**:

1. Check current usage in AWS Console
2. Request limit increase via [Service Quotas](https://console.aws.amazon.com/servicequotas/home)
3. Wait for approval before retrying deployment

### CDK Bootstrap Issues

**Symptoms**:

- Deployment fails with bootstrap-related errors
- Missing CDK toolkit stack

**Solution**:

```bash
# Bootstrap CDK in target region
cdk bootstrap aws://ACCOUNT-NUMBER/REGION

# Verify bootstrap
aws cloudformation describe-stacks --stack-name CDKToolkit
```

### IAM Permission Issues

**Symptoms**:

- Access denied errors during deployment
- Missing permissions for specific services

**Solution**:

1. Ensure deploying user/role has sufficient permissions
2. Check CloudTrail for specific permission denials
3. Add required permissions or use admin role for initial deployment

## Runtime Issues

### MediaLive Channel Won't Start

**Symptoms**:

- Channel remains in "IDLE" state
- Start channel command fails

**Common Causes**:

1. **Input not available**: Check input source is streaming
2. **Input security group**: Verify IP whitelist includes source
3. **Network connectivity**: Check network path to input
4. **Input format**: Verify input format matches channel configuration

**Debugging Steps**:

```bash
# Check channel state
aws medialive describe-channel --channel-id CHANNEL_ID

# Check channel alerts
aws medialive list-channel-alerts --channel-id CHANNEL_ID

# Review CloudWatch logs
aws logs describe-log-groups --log-group-name-prefix /aws/medialive
```

### MediaPackage Channel Issues

**Symptoms**:

- No output from MediaPackage
- Playback URLs return errors

**Common Causes**:

1. **MediaLive not outputting**: Check MediaLive channel is running and outputting
2. **Network connectivity**: Verify MediaLive can reach MediaPackage
3. **Input format mismatch**: Check MediaLive output matches MediaPackage input expectations

**Debugging Steps**:

```bash
# Check MediaPackage channel
aws mediapackagev2 get-channel --channel-group-name GROUP --channel-name CHANNEL

# Check origin endpoints
aws mediapackagev2 list-origin-endpoints --channel-group-name GROUP --channel-name CHANNEL
```

### CloudFront Distribution Issues

**Symptoms**:

- 403/404 errors from CloudFront URLs
- Slow or failed content delivery

**Common Causes**:

1. **Origin not accessible**: MediaPackage origin not reachable
2. **Cache behavior**: Incorrect caching configuration
3. **Origin request policy**: Missing required headers/query parameters

**Debugging Steps**:

1. Test origin directly (MediaPackage URLs)
2. Check CloudFront distribution configuration
3. Review CloudFront access logs
4. Test with cache disabled (`Cache-Control: no-cache` header)

### MediaTailor Session Issues

**Symptoms**:

- Session initialization fails
- Ad insertion not working
- Manifest errors

**Common Causes**:

1. **Missing dynamic variables**: Required `content_segment_prefix` or `ad_segment_prefix` not set
2. **Ad decision server**: ADS not responding or returning invalid responses
3. **Content source**: MediaTailor cannot reach content source

**Debugging Steps**:

```bash
# Test session initialization
curl -X POST "SESSION_URL" -d '{
  "reportingMode": "SERVER",
  "playerParams": {
    "content_segment_prefix": "hls-cmaf",
    "ad_segment_prefix": "hls-cmaf"
  }
}'

# Check MediaTailor logs (if enabled)
aws logs describe-log-groups --log-group-name-prefix /aws/mediatailor
```

## Performance Issues

### High Latency

**Symptoms**:

- Excessive delay between live source and playback
- Poor viewer experience

**Common Causes**:

1. **Segment duration**: Large segments increase latency
2. **CDN caching**: Aggressive caching increases latency
3. **Geographic distance**: Viewers far from origin/edge locations

**Solutions**:

1. Use low-latency configuration:
   ```bash
   --context eventGroupConfigFile=../../config/low-latency/eventGroupConfiguration.ts
   --context eventConfigFile=../../config/low-latency/eventConfiguration.ts
   ```
2. Enable CloudFront Origin Shield in viewer regions
3. Optimize segment duration and manifest caching

### Poor Video Quality

**Symptoms**:

- Pixelation, artifacts, or poor visual quality
- Audio/video sync issues

**Common Causes**:

1. **Encoding settings**: Inappropriate bitrate ladder or codec settings
2. **Source quality**: Poor input quality
3. **Network issues**: Packet loss or bandwidth constraints

**Solutions**:

1. Review and optimize encoding profile
2. Use [Encoding Profile Generator](../tools/encoding-profile-generator/README.md)
3. Monitor MediaLive input/output metrics
4. Check network connectivity and bandwidth

### High Costs

**Symptoms**:

- Unexpected AWS charges
- Higher than expected costs

**Common Causes**:

1. **MediaTailor logging**: 100% logging in production
2. **MediaPackage logging**: Enabled with high volume
3. **CloudFront data transfer**: High egress costs
4. **Unused resources**: Resources left running

**Solutions**:

1. Optimize MediaTailor logging percentage (10% or less)
2. Disable MediaPackage logging unless needed
3. Implement [cost allocation tags](configuration.md#cost-allocation-tags)
4. Regular cleanup of unused resources
5. Use reserved capacity for 24/7 workflows

## Cleanup and Deletion

### Proper Cleanup Order

**Critical**: Stacks must be deleted in reverse dependency order to avoid errors.

#### Step 1: Stop MediaLive Channel

```bash
./tools/stop_channel.sh
```

**Verify channel is stopped**:

```bash
aws medialive describe-channel --channel-id CHANNEL_ID --query 'State'
```

#### Step 2: Delete Event Stacks

```bash
# Delete all event stacks first
cdk destroy LefEventStack --context eventStackName=LefGroup1Event1 --context eventGroupStackName=LefGroup1
cdk destroy LefEventStack --context eventStackName=LefGroup1Event2 --context eventGroupStackName=LefGroup1
# ... repeat for all event stacks
```

#### Step 3: Delete Event Group Stacks

```bash
# Delete event group stacks
cdk destroy LefEventGroupStack --context eventGroupStackName=LefGroup1 --context foundationStackName=LefFoundation1
cdk destroy LefEventGroupStack --context eventGroupStackName=LefGroup2 --context foundationStackName=LefFoundation1
# ... repeat for all event group stacks
```

#### Step 4: Delete Foundation Stack

```bash
# Finally delete foundation stack
cdk destroy LefFoundationStack --context stackName=LefFoundation1
```

### Deletion Protection

The framework includes automatic deletion protection:

- **Foundation stacks** cannot be deleted while Event Group stacks depend on them
- **Event Group stacks** cannot be deleted while Event stacks depend on them

**Error Example**:

```
Cannot delete stack 'LefFoundation1' because it has dependent stacks:
['LefGroup1', 'LefGroup2']
```

### Force Cleanup (Emergency)

⚠️ **Use with extreme caution** - only for stuck deployments

```bash
# Delete via CloudFormation console
# 1. Go to CloudFormation console
# 2. Select stack
# 3. Delete (may need to skip resources)

# Or via CLI (skip failing resources)
aws cloudformation delete-stack --stack-name STACK_NAME
```

### Cleanup Verification

After deletion, verify resources are removed:

```bash
# Check CloudFormation stacks
aws cloudformation list-stacks --stack-status-filter DELETE_COMPLETE

# Check MediaLive channels
aws medialive list-channels

# Check MediaPackage resources
aws mediapackagev2 list-channel-groups

# Check CloudFront distributions
aws cloudfront list-distributions
```

## Debugging Tools and Commands

### CDK Debugging

```bash
# Synthesize templates without deploying
cdk synth

# Show differences between deployed and local
cdk diff

# List all stacks
cdk ls

# Show stack outputs
cdk deploy --outputs-file outputs.json
```

### AWS CLI Debugging

```bash
# CloudFormation events
aws cloudformation describe-stack-events --stack-name STACK_NAME

# CloudFormation resources
aws cloudformation describe-stack-resources --stack-name STACK_NAME

# Service-specific resource listing
aws medialive list-channels
aws mediapackagev2 list-channel-groups
aws cloudfront list-distributions
```

### Log Analysis

```bash
# List log groups
aws logs describe-log-groups

# Get recent log events
aws logs filter-log-events --log-group-name LOG_GROUP_NAME --start-time $(date -d '1 hour ago' +%s)000

# Follow log stream
aws logs tail LOG_GROUP_NAME --follow
```

### Network Debugging

```bash
# Test MediaPackage endpoints
curl -I "https://MEDIAPACKAGE_URL/manifest.m3u8"

# Test CloudFront endpoints
curl -I "https://CLOUDFRONT_URL/manifest.m3u8"

# Test MediaTailor session initialization
curl -X POST "MEDIATAILOR_SESSION_URL" -d '{"reportingMode":"SERVER","playerParams":{"content_segment_prefix":"hls-cmaf","ad_segment_prefix":"hls-cmaf"}}'
```

## Getting Help

### AWS Support

For AWS service-specific issues:

1. **AWS Support Console**: Create support case
2. **AWS Forums**: Community support
3. **AWS Documentation**: Service-specific troubleshooting guides

### Framework Issues

For LEF-specific issues:

1. **GitHub Issues**: Report bugs or feature requests
2. **Documentation**: Check all documentation files
3. **Code Review**: Examine CDK code for configuration issues

### Best Practices for Support Requests

1. **Include Error Messages**: Full error text and stack traces
2. **Provide Context**: What you were trying to accomplish
3. **Include Configuration**: Relevant configuration files (sanitized)
4. **Steps to Reproduce**: Clear steps to reproduce the issue
5. **Environment Details**: AWS region, CDK version, etc.

## Prevention Strategies

### Pre-Deployment Checklist

- [ ] CDK bootstrapped in target region
- [ ] Service limits reviewed and increased if needed
- [ ] Unique stack names chosen
- [ ] Configuration files validated
- [ ] IAM permissions verified
- [ ] Email address confirmed for SNS

### Monitoring Setup

- [ ] CloudWatch alarms configured
- [ ] Cost allocation tags activated
- [ ] Log retention policies set
- [ ] Backup procedures documented
- [ ] Incident response plan created

### Regular Maintenance

- [ ] Review and optimize costs monthly
- [ ] Update CDK and dependencies regularly
- [ ] Monitor service limit usage
- [ ] Review and update configurations
- [ ] Test disaster recovery procedures
