# AWS CDK MediaServices Reference Architectures

## Table of content
- [Introduction](#introduction)
- [Services](#services)
- [Prerequisites](#prerequisites)
- [Reference Architectures](#refarch)
- [License](#license)

<a name="introduction"></a>
## Introduction
The aim of this project is to provide a broader understanding of the media services as well as how to implement them to build media supply chain, media infrastructure and media application workflow
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

And demonstrate their integration with other AWS services through detailed use cases
  
<a name="prerequisites"></a>
## Prerequisites
Before you start with this project make sure you are familiar with the following tools: 
* AWS CLI v2
* AWS CDK
* AWS SDK for Python

<a name="refarch"></a>
# Reference Architectures
- Foundational
  - [live encoding loop (LILO)](LILO/README.md)
  - Social Network Publication (SNP)
  - Static packaging/origination (ORG)
  - Just in time packaging (JITP)
  - Feeder (FDR)
  - Subscriber local (SBRL)
  - Subscriber remote (SBRR)
- Advanced
  - Live to archive workflow (L2A)
  - Live broadcast workflow (BSCT)
  - Live OTT workflow (OTT)
  - Ad insertion workflow (SSAI)
  - Ad replacement workflow (SSAR)

<a name="license"></a>
## License

This library is licensed under the MIT-0 License. See the LICENSE file.
