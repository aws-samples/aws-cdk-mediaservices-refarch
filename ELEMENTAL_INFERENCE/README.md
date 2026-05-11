# Elemental Inference — Smart Crop & Event Clipping

## Log

| Date       |  Entry  | Version | Comment                           |
|------------|:-------:|:-------:|-----------------------------------|
| 27/04/2026 | created |  0.1.0  | Initial release                   |

## Disclaimer

The sample code; software libraries; command line tools; proofs of concept; templates; or other related technology is provided to you as AWS Content under the AWS Customer Agreement, or the relevant written agreement between you and AWS (whichever applies). You are responsible for testing, securing, and optimizing the AWS Content, such as sample code, as appropriate for production grade use based on your specific quality control practices and standards.

**You should not use this AWS Content in your production accounts, or on production or other critical data.**

Deploying AWS Content may incur AWS charges for creating or using AWS chargeable resources, such as running AWS Elemental MediaLive Channels or using AWS Elemental Inference.

## Prerequisites

| Tool | Version |
|------|---------|
| [Node.js](https://nodejs.org/) | >= 22.0.0 |
| [AWS CDK CLI](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html) | >= 2.1119.0 |
| [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html) | v2 |
| [TypeScript](https://www.typescriptlang.org/) | ~6.0.2 |

### Key dependencies

| Package | Version |
|---------|---------|
| `aws-cdk-lib` | ^2.251.0 |
| `constructs` | ^10.0.0 |
| `cdk-nag` | ^2.36.44 |

> **Note:** `aws-cdk-lib` >= 2.245.0 is required for the `aws_elementalinference.CfnFeed` L1 construct and `CfnChannel.InferenceSettingsProperty`.

## Table of content

- [Solution overview](#solution-overview)
- [Architecture](#architecture)
- [Deployment](#deployment)
- [Configuration](#configuration)
- [Stack outputs](#stack-outputs)
- [Running the solution](#running-the-solution)
- [Metadata API](#metadata-api)
- [File structure](#file-structure)
- [Useful commands](#useful-commands)
- [Known issues](#known-issues)
- [License](#license)

## Solution overview

This project deploys an end-to-end AWS Elemental Inference pipeline via CDK. It demonstrates two MediaLive features powered by Elemental Inference AI foundational models:

- **Smart Crop** — Converts landscape (16:9) video to vertical (9:16) using AI-detected region of interest. Produces both horizontal and vertical ABR ladders from a single live source.
- **Event Clipping** — Generates metadata identifying interesting events in live streams (currently basketball and soccer). Metadata is delivered to Amazon EventBridge for downstream clip creation.

A REST API (API Gateway + Lambda) provides operational access to feed metadata and clipping events.

### Resources deployed

| Resource | Description |
|----------|-------------|
| MediaConnect Flow | SRT listener source for live content ingest |
| MediaLive Channel | SINGLE_PIPELINE, 3 horizontal (DEFAULT) + 3 vertical (SMART_CROP) renditions, H.264 QVBR |
| Elemental Inference Feed | AI feed with clipping output; cropping output auto-created by MediaLive |
| MediaPackageV2 | Channel group with -H and -V channels, HLS origin endpoints |
| EventBridge Rule + SQS | Routes `Clip Metadata Generated` events filtered by `callbackMetadata` |
| API Gateway + Lambda | REST API with API key auth: `/feeds`, `/feeds/{feedId}`, `/events` |
| IAM Role | MediaLive role with Elemental Inference FAS, MediaConnect, MediaPackageV2, EC2 permissions |

## Architecture

```
  SRT Source ──► MediaConnect Flow (srt-listener)
                    │
                    ▼
                MediaLive Channel ──────────────────────────────────┐
                ├─ InferenceSettings.FeedArn ──► EI Feed           │
                │                                 ├─ Clipping ──► EventBridge ──► SQS
                │                                 └─ Cropping (auto)
                │
                ├─ HLS-CMAF-Horizontal (1080p/720p/360p DEFAULT)
                │  └──► MediaPackageV2 -H ──► HLS endpoint
                │
                └─ HLS-CMAF-Vertical (1080p/720p/360p SMART_CROP)
                   └──► MediaPackageV2 -V ──► HLS endpoint

                API Gateway (/feeds, /feeds/{id}, /events)
                └──► Lambda (Node.js 24.x)
```

## Deployment

1. Navigate to the project:
```bash
cd ELEMENTAL_INFERENCE
```

2. Install dependencies:
```bash
npm install
```

3. Review `lib/config.ts` — adjust parameters for your environment (see [Configuration](#configuration)).

4. Synthesize:
```bash
npx cdk synth
```

5. Deploy:
```bash
npx cdk deploy
```

## Configuration

Edit `lib/config.ts`:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `STACK_PREFIX_NAME` | `EI-RefArch` | Prefix for all resource names |
| `mediaConnect.protocol` | `srt-listener` | Source protocol |
| `mediaConnect.whitelistCidr` | `0.0.0.0/0` | Allowlist CIDR for SRT source |
| `mediaConnect.vpcConfig` | _(commented)_ | Optional VPC interface config |
| `inference.enableSmartCrop` | `true` | Enable SMART_CROP video descriptions |
| `inference.enableClipping` | `true` | Enable clipping feed output + EventBridge |
| `videoConfig.horizontal` | 1080p/720p/360p | Horizontal ABR ladder |
| `videoConfig.vertical` | 1080p/720p/360p | Vertical ABR ladder (9:16) |
| `channelGroupName` | `ei-refarch` | MediaPackageV2 channel group name |
| `callbackMetadata` | `SRC-01` | EventBridge event filter string |

## Stack outputs

| Output | Description |
|--------|-------------|
| `SourceIngestEndpoint` | SRT listener endpoint (`srt://ip:port`) — push content here |
| `FlowArn` | MediaConnect Flow ARN |
| `FeedArn` | Elemental Inference Feed ARN |
| `HorizontalEndpointUrl` | HLS playback URL for horizontal output |
| `VerticalEndpointUrl` | HLS playback URL for vertical output |
| `QueueUrl` | SQS queue URL for clipping events |
| `ApiEndpointUrl` | Metadata API base URL |
| `ApiKeyId` | API key ID for API access |

## Running the solution

1. Start the MediaConnect flow:
```bash
aws mediaconnect start-flow --flow-arn <FlowArn>
```

2. Push SRT content to the `SourceIngestEndpoint` output (e.g., `srt://35.164.64.44:5000`).

3. Start the MediaLive channel:
```bash
aws medialive start-channel --channel-id <channel-id>
```

4. Play the HLS streams using `HorizontalEndpointUrl` and `VerticalEndpointUrl`.

### Cleanup

1. Stop the MediaLive channel and MediaConnect flow.
2. Destroy the stack:
```bash
npx cdk destroy
```

## Metadata API

Requires an API key in the `x-api-key` header. Retrieve the key:
```bash
aws apigateway get-api-key --api-key <ApiKeyId> --include-value --query "value" --output text
```

| Method | Path | Description |
|--------|------|-------------|
| GET | `/feeds` | List all Elemental Inference feeds |
| GET | `/feeds/{feedId}` | Get feed details (outputs, association, status) |
| GET | `/events` | Poll SQS for recent clipping event metadata |

```bash
curl -H "x-api-key: <value>" https://<api-id>.execute-api.<region>.amazonaws.com/prod/feeds
```

## File structure

```
ELEMENTAL_INFERENCE/
├── bin/
│   └── index.ts                              # CDK App entry point
├── lib/
│   ├── config.ts                             # Default configuration
│   ├── configInterface.ts                    # TypeScript interfaces
│   ├── stack/
│   │   └── elemental-inference-stack.ts      # Main stack
│   └── constructs/
│       ├── elemental-inference-feed.ts       # Elemental Inference Feed (CfnFeed L1)
│       ├── media-connect.ts                  # MediaConnect flow + MediaLive input
│       ├── media-live.ts                     # MediaLive channel with inference
│       ├── media-package.ts                  # MediaPackageV2 channels + endpoints
│       ├── event-bridge.ts                   # EventBridge rule + SQS queue
│       └── metadata-api.ts                   # API Gateway + Lambda
├── lambda/
│   ├── list-feeds/index.ts                   # GET /feeds
│   ├── get-feed/index.ts                     # GET /feeds/{feedId}
│   └── get-events/index.ts                   # GET /events
├── package.json
├── tsconfig.json
├── cdk.json
└── jest.config.js
```

## Useful commands

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript |
| `npm run test` | Run Jest tests |
| `npx cdk synth` | Synthesize CloudFormation template |
| `npx cdk deploy` | Deploy stack |
| `npx cdk diff` | Compare deployed vs current |
| `npx cdk destroy` | Remove the stack |

## Known issues

- Elemental Inference is a newer service — availability may be limited to specific AWS regions.
- Event clipping currently supports basketball and soccer content only.
- Smart Crop is not supported on MediaLive Anywhere channels.
- The `whitelistCidr: 0.0.0.0/0` default allows any source IP — restrict this for production use.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.
