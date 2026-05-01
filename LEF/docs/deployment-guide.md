# Deployment Guide

This guide covers detailed deployment options for the Live Event Framework.

## Deployment Options Overview

The Live Event Framework supports two deployment approaches:

- **Option A: Deploy All** - Single command deployment (recommended for quick start)
- **Option B: Step-by-Step** - Manual control over each stack deployment

## Option A: Deploy All (Single Command)

### Basic Deployment

Deploy all three stacks with default names:

```bash
cdk deploy --all \
  --context userEmail=YOUR_EMAIL \
  --outputs-file ./cdk-exports-all.json
```

### Custom Stack Names

Deploy with custom stack names:

```bash
cdk deploy --all \
  --context foundationStackName=MyFoundation \
  --context eventGroupStackName=MyEventGroup \
  --context eventStackName=MyEvent \
  --context userEmail=YOUR_EMAIL \
  --outputs-file ./cdk-exports-all.json
```

### Custom Configuration Files

Use custom configuration files:

```bash
cdk deploy --all \
  --context foundationConfigFile=../../config/custom/foundationConfiguration.ts \
  --context eventGroupConfigFile=../../config/custom/eventGroupConfiguration.ts \
  --context eventConfigFile=../../config/custom/eventConfiguration.ts \
  --context userEmail=YOUR_EMAIL \
  --outputs-file ./cdk-exports-all.json
```

### What Happens During Deploy All

1. **Foundation Stack** deploys first with shared resources
2. **SNS subscription email** is sent to your email address
3. **Event Group Stack** deploys with MediaPackage and CloudFront resources
4. **Event Stack** deploys with MediaLive channel
5. **Deployment completes** without waiting for email confirmation

**Important**: You must confirm the SNS subscription email after deployment for notifications to work.

You can add further channels into your environment by deploying additional event stacks as described in [Multiple Events](#deploying-multiple-events-in-same-event-group).

## Option B: Step-by-Step Deployment

For more advanced controls, you can deploy each stack seperately.

### Prerequisites Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/aws-samples/aws-cdk-mediaservices-refarch
   cd aws-cdk-mediaservices-refarch/LEF
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Stack Dependencies

Understanding the dependency chain:

```
Foundation Stack
    ↓
Event Group Stack(s)
    ↓
Event Stack(s)
```

- **Foundation** must be deployed first
- **Event Groups** depend on Foundation
- **Events** depend on their Event Group
- Multiple Event Groups can share one Foundation
- Multiple Events can share one Event Group

### Step 1: Deploy Foundation Stack

```bash
npx cdk deploy LefFoundationStack \
  --context foundationStackName=LefFoundation1 \
  --context userEmail=YOUR_EMAIL \
  --outputs-file ./cdk-exports-foundation.json
```

**Custom Configuration:**

```bash
npx cdk deploy LefFoundationStack \
  --context foundationStackName=LefFoundation1 \
  --context foundationConfigFile=path/to/your/foundationConfiguration.ts \
  --context userEmail=YOUR_EMAIL \
  --outputs-file ./cdk-exports-foundation.json
```

### Step 2: Confirm Email Subscription

⚠️ **CRITICAL**: Before proceeding, you **must** confirm the SNS subscription email sent to your address. The Event Group deployment will fail if the email subscription is not confirmed.

1. Check your email (including spam folder)
2. Click "Confirm subscription" in the email
3. Wait for confirmation page to load

### Step 3: Deploy Event Group Stack

```bash
npx cdk deploy LefEventGroupStack \
  --context eventGroupStackName=LefGroup1 \
  --context foundationStackName=LefFoundation1 \
  --outputs-file ./cdk-exports-event-group.json
```

**Custom Configuration:**

```bash
npx cdk deploy LefEventGroupStack \
  --context eventGroupStackName=LefGroup1 \
  --context foundationStackName=LefFoundation1 \
  --context eventGroupConfigFile=path/to/your/eventGroupConfiguration.ts \
  --outputs-file ./cdk-exports-event-group.json
```

### Step 4: Deploy Event Stack

**Standard Configuration (Event Group MediaTailor):**

```bash
npx cdk deploy LefEventStack \
  --context eventStackName=LefGroup1Event1 \
  --context eventGroupStackName=LefGroup1 \
  --outputs-file ./cdk-exports-event.json
```

**Advanced Configuration (Event-Specific MediaTailor):**

```bash
npx cdk deploy LefEventStack \
  --context eventStackName=LefGroup1Event1 \
  --context eventGroupStackName=LefGroup1 \
  --context eventConfigFile=../../config/default/eventAdvancedConfiguration.ts \
  --outputs-file ./cdk-exports-event.json
```

**Custom Configuration:**

```bash
npx cdk deploy LefEventStack \
  --context stackName=LefGroup1Event1 \
  --context eventConfigFile=path/to/your/eventConfiguration.ts \
  --parameters eventGroupStackName=LefGroup1 \
  --outputs-file ./cdk-exports-event.json
```

## Multiple Events and Event Groups

### Deploying Multiple Events in Same Event Group

Deploy additional events in the same event group:

```bash
# Second event
npx cdk deploy LefEventStack \
  --context stackName=LefGroup1Event2 \
  --parameters eventGroupStackName=LefGroup1 \
  --outputs-file ./cdk-exports-event2.json

# Third event
npx cdk deploy LefEventStack \
  --context stackName=LefGroup1Event3 \
  --parameters eventGroupStackName=LefGroup1 \
  --outputs-file ./cdk-exports-event3.json
```

### Deploying Multiple Event Groups

Deploy additional event groups using the same foundation:

```bash
# Second event group
npx cdk deploy LefEventGroupStack \
  --context stackName=LefGroup2 \
  --parameters foundationStackName=LefFoundation1 \
  --outputs-file ./cdk-exports-event-group2.json

# Event in second group
npx cdk deploy LefEventStack \
  --context stackName=LefGroup2Event1 \
  --parameters eventGroupStackName=LefGroup2 \
  --outputs-file ./cdk-exports-event-group2-event1.json
```

## Configuration Files

### Default Configuration Locations

- **Foundation**: `config/default/foundationConfiguration.ts`
- **Event Group**: `config/default/eventGroupConfiguration.ts`
- **Event**: `config/default/eventConfiguration.ts`
- **Event Advanced**: `config/default/eventAdvancedConfiguration.ts`

### Low-Latency Configurations

Use pre-configured low-latency settings:

```bash
--context eventGroupConfigFile=../../config/low-latency/eventGroupConfiguration.ts
--context eventConfigFile=../../config/low-latency/eventConfiguration.ts
```

### Creating Custom Configurations

1. Copy a default configuration file
2. Modify parameters as needed
3. Reference in deployment command using `--context` parameters

## Deployment Validation

### Verify Successful Deployment

1. **Check CloudFormation Console**: All stacks should show `CREATE_COMPLETE`
2. **Verify Resources**: MediaLive channel, MediaPackage channel group/channel, CloudFront distribution
3. **Test Email**: Confirm SNS subscription is active
4. **Start Channel**: Use `./tools/start_channel.sh` to verify channel starts successfully

### Common Deployment Issues

- **Email not confirmed**: Event Group deployment fails
- **Stack name conflicts**: Use unique stack names
- **Service limits**: Check AWS quotas for MediaLive/MediaPackage
- **CDK bootstrap**: Ensure CDK is bootstrapped in target region

## Cleanup and Deletion

### Deletion Order

Stacks must be deleted in reverse dependency order:

1. **Stop MediaLive Channel**: `./tools/stop_channel.sh`
2. **Delete Event Stacks**: `cdk destroy LefEventStack --context stackName=...`
3. **Delete Event Group Stacks**: `cdk destroy LefEventGroupStack --context stackName=...`
4. **Delete Foundation Stack**: `cdk destroy LefFoundationStack --context stackName=...`

### Deletion Protection

The framework includes automatic deletion protection:

- Foundation stacks cannot be deleted while Event Group stacks depend on them
- Event Group stacks cannot be deleted while Event stacks depend on them
- Deletion attempts will fail with clear error messages listing dependent stacks

## Advanced Deployment Scenarios

### Cross-Region Deployments

Deploy foundation and event groups in different regions by setting CDK region context or using different AWS profiles.

### Multi-Account Deployments

Deploy foundation in shared services account and event groups in application accounts using cross-account IAM roles.

### CI/CD Integration

Integrate deployments into CI/CD pipelines using CDK CLI commands with appropriate IAM permissions and environment variables.

## Troubleshooting

For deployment issues, see the [Troubleshooting Guide](troubleshooting.md).
