# WAF Implementation for Live Event Framework

## Overview

AWS WAF (Web Application Firewall) has been integrated into the Live Event Framework to protect CloudFront distributions from malicious IP addresses and common web exploits.

## Architecture

- **Deployment Level**: Separate WAF Stack (automatically created when needed)
- **Region**: us-east-1 (required for CloudFront WAF)
- **Scope**: Protects the CloudFront distribution shared by all events in an event group

## How It Works

When you enable WAF in the Event Group configuration, the framework automatically:

1. **Creates a separate WAF Stack** in us-east-1 (regardless of where your Event Group Stack is deployed)
2. **Passes the Web ACL ARN** from the WAF Stack to the Event Group Stack using CDK cross-region references
3. **Associates the Web ACL** with the CloudFront distribution

This allows you to deploy your Event Group Stack in any region while the WAF Web ACL is always created in us-east-1 as required by AWS.

### Stack Architecture

```
┌─────────────────────────────────────┐
│  LefWafStack (us-east-1)            │
│  - WAF Web ACL                      │
│  - AWS Managed Rules                │
└──────────────┬──────────────────────┘
               │ Web ACL ARN
               ▼
┌─────────────────────────────────────┐
│  LefEventGroupStack (any region)    │
│  - CloudFront Distribution          │
│  - MediaPackage Channel Group       │
│  - MediaTailor Configurations       │
└─────────────────────────────────────┘
```

## Features

### Three Deployment Options

1. **Automatic WAF Stack Creation** (Recommended)
   - Enable WAF in configuration
   - Framework automatically creates a separate WAF Stack in us-east-1
   - Includes AWS Managed Rule: `AWSManagedRulesAnonymousIpList`
   - Works regardless of Event Group Stack region

2. **Use Existing Web ACL**
   - Reference an existing Web ACL by ARN in configuration
   - No new WAF Stack is created
   - Useful for sharing WAF configurations across multiple event groups

3. **No WAF** (Default)
   - Leave WAF disabled in configuration
   - No WAF Stack created, no Web ACL associated

## Configuration

### Option 1: Enable WAF with Automatic Stack Creation (Recommended)

Edit `LEF/config/default/eventGroupConfiguration.ts`:

**Basic Configuration** (Anonymous IP blocking only):

```typescript
export const EVENT_GROUP_CONFIG: IEventGroupConfig = {
  cloudFront: {
    // ... other config ...
    waf: {
      enabled: true,
    },
  },
  // ... rest of config ...
};
```

**Advanced Configuration** (with IP allow list and geo-blocking):

```typescript
export const EVENT_GROUP_CONFIG: IEventGroupConfig = {
  cloudFront: {
    // ... other config ...
    waf: {
      enabled: true,
      // Allow specific IPv4 addresses (bypasses all other rules)
      allowedIpv4Addresses: ["192.0.2.0/24", "198.51.100.0/24"],
      // Allow only specific countries (blocks all others)
      allowedCountryCodes: ["US", "CA", "GB", "AU"],
      // Block anonymous IPs (default: true)
      blockAnonymousIps: true,
    },
  },
  // ... rest of config ...
};
```

**Minimal Configuration** (geo-blocking only, no anonymous IP blocking):

```typescript
export const EVENT_GROUP_CONFIG: IEventGroupConfig = {
  cloudFront: {
    // ... other config ...
    waf: {
      enabled: true,
      allowedCountryCodes: ["US"],
      blockAnonymousIps: false, // Disable anonymous IP blocking
    },
  },
  // ... rest of config ...
};
```

This will automatically create a separate WAF Stack in us-east-1 when you deploy the Event Group Stack.

### Option 2: Use Existing Web ACL

If you already have a WAF Web ACL or want to share one across multiple event groups:

```typescript
export const EVENT_GROUP_CONFIG: IEventGroupConfig = {
  cloudFront: {
    // ... other config ...
    waf: {
      enabled: true,
      webAclArn:
        "arn:aws:wafv2:us-east-1:123456789012:global/webacl/example/a1b2c3d4-5678-90ab-cdef-EXAMPLE11111",
    },
  },
  // ... rest of config ...
};
```

When `webAclArn` is provided, no new WAF Stack will be created.

### Option 3: Disable WAF (Default)

Leave the WAF configuration commented out or set `enabled: false`:

```typescript
export const EVENT_GROUP_CONFIG: IEventGroupConfig = {
  cloudFront: {
    // ... other config ...
    // waf: {
    //   enabled: false,
    // },
  },
  // ... rest of config ...
};
```

## Deployment

### Automatic Deployment (Recommended)

When WAF is enabled in configuration, both stacks are deployed together:

```bash
# Deploy Event Group Stack (in any region)
# WAF Stack will be automatically created in us-east-1
npx cdk deploy LefEventGroupStack \
  --context eventGroupStackName=LefGroup1 \
  --context foundationStackName=LefFoundation1 \
  --outputs-file ./cdk-exports-event-group.json
```

CDK will automatically:

1. Create the WAF Stack in us-east-1 (named `{StackName}-WAF`)
2. Create the Event Group Stack in your specified region
3. Pass the Web ACL ARN between stacks using cross-region references

### Deployment Order

CDK handles the deployment order automatically:

1. **LefWafStack** is deployed first (in us-east-1)
2. **LefEventGroupStack** is deployed second (in your region)
3. Cross-region reference is established automatically

### Outputs

After deployment, you'll see outputs from both stacks:

**WAF Stack Outputs:**

- `WafWebAclArn` - The ARN of the created Web ACL
- `WafWebAclId` - The ID of the created Web ACL

**Event Group Stack Outputs:**

- `WafWebAclArn` - The ARN of the Web ACL being used (for reference)
- All other Event Group outputs (CloudFront, MediaTailor, etc.)

## Monitoring

WAF metrics are automatically sent to CloudWatch:

- **Metric Namespace**: `AWS/WAFV2`
- **Dimensions**:
  - `Rule`: Individual rule metrics
  - `WebACL`: Overall Web ACL metrics
- **Key Metrics**:
  - `AllowedRequests` - Requests allowed by the Web ACL
  - `BlockedRequests` - Requests blocked by the Web ACL
  - `CountedRequests` - Requests counted (for testing rules)

### Viewing Metrics

1. Open CloudWatch Console
2. Navigate to Metrics → WAFV2
3. Select your Web ACL name: `{EventGroupName}-WebACL`

### Viewing Sampled Requests

1. Open AWS WAF Console (in us-east-1)
2. Navigate to Web ACLs
3. Select your Web ACL
4. Click "Sampled requests" tab to see recent requests

## Cost Considerations

WAF pricing includes:

- **Web ACL**: $5.00 per month per Web ACL
- **Rules**: $1.00 per month per rule
- **Requests**: $0.60 per million requests

**Example Monthly Cost** (for 100M requests):

**Base Configuration** (Anonymous IP List only):

- Web ACL: $5.00
- Rules (1): $1.00
- Requests: $60.00
- **Total**: ~$66.00/month

**With IP Allow List + Geo-Blocking**:

- Web ACL: $5.00
- Rules (3): $3.00
- Requests: $60.00
- **Total**: ~$68.00/month

For current pricing, see: https://aws.amazon.com/waf/pricing/

## WAF Rules Included

The WAF Web ACL includes the following rules in priority order:

### 1. Allow Listed IPv4 Addresses (Optional - Priority 0)

If configured, allows traffic from specific IPv4 addresses, bypassing all other rules:

- Useful for allowing known good IPs (corporate offices, CDN origins, etc.)
- Supports CIDR notation (e.g., "192.0.2.0/24")
- Highest priority - evaluated first

**Configuration:**

```typescript
waf: {
  enabled: true,
  allowedIpv4Addresses: ["192.0.2.0/24", "198.51.100.0/24"],
}
```

### 2. Geo-Blocking (Optional - Priority 1)

If configured, blocks all countries except those in the allowed list:

- Uses ISO 3166-1 alpha-2 country codes (e.g., "US", "CA", "GB")
- Ideal for content with geographic licensing restrictions
- Evaluated after IP allow list

**Configuration:**

```typescript
waf: {
  enabled: true,
  allowedCountryCodes: ["US", "CA", "GB"],
}
```

### 3. AWSManagedRulesAnonymousIpList (Optional - Priority 2/3)

If enabled (default: true), blocks requests from services that allow obfuscation of viewer identity:

- VPN services
- Proxy services
- Tor exit nodes
- Hosting providers commonly used for anonymization
- Regularly updated by AWS based on known anonymous IP sources

This rule group is ideal for protecting streaming content from:

- Content piracy and unauthorized redistribution
- Geographic restriction bypass attempts
- Anonymous scraping and bot activity
- Users attempting to hide their true location or identity

**Configuration:**

```typescript
waf: {
  enabled: true,
  blockAnonymousIps: true, // default: true
}
```

To disable anonymous IP blocking:

```typescript
waf: {
  enabled: true,
  blockAnonymousIps: false,
}
```

## Customization

To add additional AWS Managed Rule Groups or create custom rules, you can:

1. Create the Web ACL manually in the AWS WAF Console (in us-east-1)
2. Reference it in your configuration using the `webAclArn` parameter

Available AWS Managed Rule Groups:

- `AWSManagedRulesCommonRuleSet` - OWASP Top 10 protection
- `AWSManagedRulesKnownBadInputsRuleSet` - Known bad inputs
- `AWSManagedRulesAmazonIpReputationList` - Known malicious IP addresses
- `AWSManagedRulesBotControlRuleSet` - Bot protection (additional cost)
- And more - see AWS documentation

## Troubleshooting

### False Positives

If legitimate requests are being blocked:

1. Check CloudWatch Logs for blocked requests
2. Review sampled requests in WAF Console (us-east-1)
3. Consider using COUNT mode for testing:
   - Modify the Web ACL in AWS Console
   - Change rule action from BLOCK to COUNT
   - Monitor for 24-48 hours
   - Adjust rules as needed

### Web ACL Not Applied

Verify:

- WAF is enabled in configuration: `waf.enabled: true`
- Both stacks deployed successfully
- CloudFront distribution shows Web ACL association in console

### Cross-Region Reference Issues

If you see errors about cross-region references:

- Ensure both stacks are defined in the same CDK app (`bin/lef.ts`)
- Check that account is explicitly specified (not using tokens)
- Verify CDK has permissions to create SSM parameters

## Stack Deletion

When deleting stacks:

1. **Delete Event Group Stack first**

   ```bash
   npx cdk destroy LefEventGroupStack --context eventGroupStackName=LefGroup1 --context foundationStackName=LefFoundation1
   ```

2. **Then delete WAF Stack**
   ```bash
   npx cdk destroy LefWafStack --context eventGroupStackName=LefGroup1
   ```

Note: The WAF Stack cannot be deleted while the Event Group Stack is still using it.

## Security Best Practices

1. **Enable CloudWatch Logging**: Monitor WAF activity regularly
2. **Review Sampled Requests**: Check for attack patterns and false positives
3. **Set Up Alarms**: Create CloudWatch alarms for blocked request spikes
4. **Regular Updates**: AWS Managed Rules are automatically updated by AWS
5. **Combine with Other Security**: Use WAF alongside:
   - CloudFront signed URLs/cookies
   - Secure Media Delivery at the Edge solution
   - MediaPackage encryption

## References

- [AWS WAF Documentation](https://docs.aws.amazon.com/waf/)
- [AWS Managed Rules](https://docs.aws.amazon.com/waf/latest/developerguide/aws-managed-rule-groups.html)
- [WAF Best Practices](https://docs.aws.amazon.com/waf/latest/developerguide/security-best-practices.html)
- [CDK Cross-Region References](https://docs.aws.amazon.com/cdk/v2/guide/resources.html#resources_referencing)
