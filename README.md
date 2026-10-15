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
* AWS Elemental MediaConvert (EMC) 
* AWS Elemental MediaPackage (EMP) 
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
| [Live Event Framework (LEF)](LEF/README.md) | Advanced | Sample Live Event Framework supporting the deployment of multiple concurrent MediaPackage V2 live events (or 24x7 channel) with or without MediaTailor Ad Insertion. |
| [Live Low Latency OTT workflow using MediaPackage V2 (OTT_LOW_LATENCY)](OTT_LOW_LATENCY/README.md) | Advanced | Creating a highly configurable low latency and standard latency Live OTT stream using MediaLive, MediaPackage V2 and CloudFront. For HLS and CMAF deployments. |
| [Live Ad insertion workflow (SSAI) - now deprecated, use Live Event Framework](LEF/README.md) | Advanced |  Example to provide Dynamic Ad Insertion using MediaTailor. |
| [Live Ad insertion workflow (SSAI_CMAF_AND_DASH) - now deprecated, use Live Event Framework](LEF/README.md) | Advanced |  Example to provide Dynamic Ad Insertion using MediaTailor with CMAF and DASH. |
| [Sustainable Outputs from MediaLive (SUSTAINABILITY_LIVE)](SUSTAINABILITY_LIVE/README.md) | Professional |  Sustainable code example to cover how to share encodes across multple outputs. |
| [MediaLive Private Networking Output (PRIVATE_LIVE)](PRIVATE_LIVE/README.md) | Professional |  Sample code for sending an output from MediaLive via a VPC (and a private subnet). This could be to your own Origin solution running in your VPC. |
| [Monitoring your Live Workflow (LIVE_CW_MONITOR)](LIVE_CW_MONITOR/README.md) | Professional |  Example of using CloudWatch dashboards to monitor your live workflow with CloudWatch metrics produced by MediaLive & MediaPackage. |
| [Monitoring your MediaLive input and output with thumbnails (LIVE_THUMBNAIL_MONITORING)](LIVE_THUMBNAIL_MONITORING/README.md) | Professional |  Example of using MediaLive source thumbnails and output frame capture to build a HTML template for monitoring your live stream. |
| [Infrastructure for granting EMX Entitlements to another account and stop secrets being shared via another medium (EMX_SECRET_SHARING)](EMX_SECRET_SHARING/README.md) | Advanced |  Example architecture on how you could share secrets automatically between accounts, without having to use another medium. |


<a name="license"></a>
## License

This library is licensed under the MIT-0 License. See the LICENSE file.
