# AWS CDK MediaServices Reference Architectures

## Table of content
- [Introduction](#introduction)
- [Services](#services)
- [Prerequisites](#prerequisites)
- [Reference Architectures](#refarch)
- [License](#license)

<a name="introduction"></a>
## Introduction
The aim of this project is to provide a broader understanding of the media services as well as how to implement them to build media supply chain, media infrastructure and media application workflow.
<a name="services"></a>
## Services
This project will provide you with deployment samples for the following AWS services:
* AWS Elemental Connect (EMX) 
* AWS Elemental MediaLive (EML) 
* AWS Elemental MediaLive Statmux (EML-STX) 
* AWS Elemental MediaLink (EMK) 
* AWS Elemental MediaConvert (EMC) 
* AWS Elemental MediaPackage (EMP) 
* AWS Elemental MediaStore (EMS) 
* AWS Elemental MediaTailor (EMT) 
* AWS Elemental Channel Assembly (ECA) 
* AWS Elemental Secure Packager and Encoder Key Exchange  (SPEKE) 
* Amazon Interactive Video Service (IVS) 

Some examples will also demonstrate the integration of MediaServices with other AWS services through detailed use cases.
  
<a name="prerequisites"></a>
## Prerequisites
Before you start with this project make sure you are familiar with the following tools: 
* AWS CLI v2
* AWS CDK
* AWS SDK for Python

<a name="refarch"></a>

## Reference Architectures

| Example | Type | Description |
|---------|------|-------------|
| [live encoding loop (LILO)](LILO/README.md) | Foundational | The live encoding loop example is intended to provide a live channel from a video file. |
| [Live OTT workflow (OTT)](OTT/README.md) | Advanced | Creating a highly configurable Live OTT streaming using MediaLive, MediaPackage and CloudFront.  |
| [Live Ad insertion workflow (SSAI)](SSAI/README.md) | Advanced |  Example to provide Dynamic Ad Insertion using MediaTailor. |
| [Sustainable Outputs from MediaLive (SUSTAINABILITY_LIVE)](SUSTAINABILITY_LIVE/README.md) | Professional |  Sustainable code example to cover how to share encodes across multple outputs. |
| [MediaLive Private Networking Output (PRIVATE_LIVE)](PRIVATE_LIVE/README.md) | Professional |  Sample code for sending an output from MediaLive via a VPC (and a private subnet). This could be to your own Origin solution running in your VPC. |
| [Live2VoD workflow (LIVE2VOD)](LIVE2VOD/README.md) | Professional |  Example for demonstrating a Live2VoD workflow in CDK, which uses a REST API to initiate the Harvest with MediaPackage and EventBridge to capture the completition. |
| [Audio Only with EMP workflow (AUDIO_ONLY_EMP)](AUDIO_ONLY_EMP/README.md) | Professional |  Example use case of using Elemental MediaLive & Elemental MediaPackage to create a simple audio only workflow. |
| [Monitoring your Live Workflow (LIVE_CW_MONITOR)](LIVE_CW_MONITOR/README.md) | Professional |  Example of using CloudWatch dashboards to monitor your live workflow with CloudWatch metrics produced by MediaLive & MediaPackage. |
| [Monitoring your MediaLive input and output with thumbnails (LIVE_THUMBNAIL_MONITORING)](LIVE_THUMBNAIL_MONITORING/README.md) | Professional |  Example of using MediaLive source thumbnails and output frame capture to build a HTML template for monitoring your live stream. |

## Coming Soon
| Example | Type | Description |
|---------|------|-------------|
| Social Network Publication (SNP) | Foundational | This example is intended to provide a live channel to publish directly to social network platform using RTMP output. |
| Static packaging/origination (ORG) | Foundational |  |
| Feeder (FDR) | Foundational |  |
| Subscriber local (SBRL) | Foundational |  |
| Subscriber remote (SBRR) | Foundational |  |
| Live to archive workflow (L2A) | Advanced |   |
| Live broadcast workflow (BSCT) | Advanced |   |
| Live OTT workflow (OTT_SECURE) | Advanced | Creating a highly configurable Live OTT streaming using MediaLive, MediaPackage and CloudFront using Secure Media Delivery at the Edge Solution. |
| Ad insertion workflow (SSAI_SECURE) | Advanced |  Example to provide Dynamic Ad Insertion using MediaTailor. This example provides an integration with the Secure Media Delivery at the Edge solution for a secure streaming. |

<a name="license"></a>
## License

This library is licensed under the MIT-0 License. See the LICENSE file.
