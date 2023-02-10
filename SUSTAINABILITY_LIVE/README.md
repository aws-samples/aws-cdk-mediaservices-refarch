# Sustainable Workflow using MediaLive
## Log
| Date        | Entry   | Version | Comment                             |
|-------------|:-------:|:-------:|-------------------------------------|
| 24/01/2022  | created | 0.0.1   | initial release of the application  | 

## Disclaimer 

The sample code; software libraries; command line tools; proofs of concept; templates; or other related technology is provided to you as AWS Content under the AWS Customer Agreement, or the relevant written agreement between you and AWS (whichever applies). You are responsible for testing, securing, and optimizing the AWS Content, such as sample code, as appropriate for production grade use based on your specific quality control practices and standards. You should not use this AWS Content in your production accounts, or on production or other critical data. Deploying AWS Content may incur AWS charges for creating or using AWS chargeable resources, such as running AWS Elemental Live Channels or using AWS Elemental MediaPackage.

## Table of content
- [Solution overview](#solution)
- [Use case](#use_case)
- [Architecture](#architecture)
- [CDK deployment](#cdk)
- [Deployment](#deployment)
- [Known issues](#known_issues)
- [File structure](#files_structure)
- [Tutorial](#tutorial)
- [License](#license)

<a name="solution"></a>
## Solution overview
Media Services reference architecture to demonstrate the following:
1. Single encode shared between 2 outputs on MediaLive - distributing to both MediaPackage and MediaConnect to show multiple outputs (but same encode)
2. MediaLive output to MediaConnect flow using RTP-FEC - demonstrating output to MediaConnect for encode/output distribution to other destinations such as Partners, Distributors or other regions.

### Use Case & Benefits
1. Reducing the efforts and errors of configuring multiple encodes per an output with identical profiles
2. Sustainability benefits; without this configuration separate encode processes would be running for each encode. With reuse the encode processes are reduced and with that CPU, power and cooling are saved.

### Sustainability
AWS has always been focused on improving efficiency in every aspect of our infrastructure. From the highly available infrastructure that powers our servers, to techniques we use to cool our data centers, and the innovative server designs that deliver AWS services to our customers—energy efficiency is a primary goal of our global infrastructure.

AWS also provides customers with several tools to help them meet their sustainability goals. For example, the AWS customer carbon footprint tool calculates the carbon emissions generated from AWS usage, enabling customers to incorporate their AWS carbon footprint into their own sustainability reporting.

For more information visit our [page on Sustainability](https://aws.amazon.com/sustainability/).

<a name="architecture"></a>
## Architecture

### Code Sample Architecture

![Simplified Architecture](./images/channels.drawio.png)

<a name="cdk"></a>
## CDK deployment
Visit our [AWS cloud Development Kit](https://aws.amazon.com/cdk/) for more information on CDK.
Get hands-on with CDK running the [CDK introduction workshop](https://cdkworkshop.com/30-python.html).
For this project we will make use of [Typescript version of CDK](https://docs.aws.amazon.com/cdk/v2/guide/work-with-cdk-typescript.html). 
We will create a Typescript app using CDK, this app will abstract all the CloudFormation stack and resource creation.
More information on [CDK best practice](https://docs.aws.amazon.com/cdk/latest/guide/best-practices.html#best-practices-apps) can be found on AWS website.
### Requirements
* [Create an AWS account](_https__:__//portal.aws.amazon.com/gp/aws/developer/registration/index.html_) if you do not already have one and log in. The IAM user that you use must have sufficient permissions to make necessary AWS service calls and manage AWS resources.
* [AWS CLI](_https__:__//docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html_) installed and configured
* [Git Installed](_https__:__//git-scm.com/book/en/v2/Getting-Started-Installing-Git_)
* [AWS Cloud Development Kit](_https__:__//docs.aws.amazon.com/cdk/v2/guide/getting_started.html_) (AWS CDK >= 2.2.0) Installed
* Language used: *Typescript*
* Framework: *AWS CDK*
### Deployment Instructions

1. Create a new directory, navigate to that directory in a terminal and clone the GitHub repository:
```bash
git clone https://raw.githubusercontent.com/aws-samples/aws-cdk-mediaservices-refarch
```

2. Change directory to the pattern directory:
```bash
cd 
```

3. Install node modules:
```bash
npm install
```

4. Create a bucket in your account, and upload a file to be used as input on the workflow

5. Update your configuration in `config.ts` to work in your account - you will need to provide the bucket name and file name created/uploaded in the previous step.

6. Build CDK App
```bash
npm run build
```

7. Deploy Media Stack
```bash
npm run cdk deploy MediaServicesRefArch-sustainable-workflow
```

## Running the solution

Once your system is deployed and configured correctly with the right downstream origin/system - you'll need to start the following:
- MediaConnect flow
- MediaLive channel

### Cleanup
1. Stop MediaLive channel

2. Stop MediaConnect Flows

3. Delete the stack

<a name="tutorial"></a>
## Tutorial
See [this useful workshop](https://cdkworkshop.com/20-typescript.html) on working with the AWS CDK for typescript projects.
More about AWS CDK v2 reference documentation [here](https://docs.aws.amazon.com/cdk/api/v2/).
### Useful commands

 * `npm run build`   compile typescript to js
 * `npm run watch`   watch for changes and compile
 * `npm run test`    perform the jest unit tests
 * `cdk ls`          list all stacks in the app
 * `cdk synth`       emits the synthesized CloudFormation template
 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk docs`        open CDK documentation
 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk synth`       emits the synthesized CloudFormation template

### Best practice
* **Security**:
Content security is key to the success of a streaming platform. So make sure to make use of encryption at rest for your assets with the bucket encryption capabilities and secure the transport of your content with https or s3ssl protocols. Ensure you have authentication and authorization in place at a level commensurate with the sensitivity and regulatory requirements of your assets. Consider using MFA whenever possible to access your ressources. Where possible access logging should also be enabled and encrypted.
* **Reliability**: 
For demos and debugging purpose this solution run a single pipeline to process your content. 
However, in a production environment make sure to remove any single point of failure by using the STANDARD mode  which allows for dual pipeline creation to process your content in the cloud. 
* **Operation**: 
Enabling logs on the channel will give you more insight on what is happening in your infrastructure should you need to investigate any issue.
You can enhance your CDK application with API calls to automate operational tasks based on triggers. 
* **Cost**: 
Review your encoding settings to optimize your ABR ladder.
Consider reservation for 24/7 workflow.
Make use of bandwidth optimized control rate such as QVBR to save bandwidth on CDN usage when possible.

<a name="license"></a>
## License
This library is licensed under the MIT-0 License. See the LICENSE file.
