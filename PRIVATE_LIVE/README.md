# Media Services with Private VPC Delivery
## Log
| Date        | Entry   | Version | Comment                             |
|-------------|:-------:|:-------:|-------------------------------------|
| 15/02/2023  | created | 0.0.1   | initial release of the application  | 

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
This sample solution provides a practical code example for using a custom VPC and private networking with MediaLive.
Should a customer want to deliver their content over their own predefined networking, they can use this template to help them configure how to do so.
To do this, this demo uses MediaConnect to receive content from Elemental Live into MediaLive, MediaLive then uses VPC options to deliver content to the right subnet (in an AZ).

<a name="use_case"></a>
## Use case
In some cases you might want to ensure that streams from MediaLive is going via your predefined networking thus not leaving your VPC. By default (without this being configured) your MediaLive output will go to the edge of the AWS network and onto a downstream systems/origins.

<a name="architecture"></a>
## Architecture

### Code Sample Architecture
For this sample, we have broken it down to be simpler and less resources deployed into your account.

![Code Sample Architecture](./images/Private\ VPC\ Diagram-Code\ Demo.drawio.png)

### Full Architecture

In the full architecture diagram below, there are a few improvements to be seen versus the code sample provided:
1. The code sample only uses a single pipeline - for redudency, we recommend using a standard pipeline (across 2 AZ's)
2. There is only 1 output stream going to an origin (for simplicity only) - we recommend building and deploying a full ABR ladder.

![Full Sample Architecture](./images/Private\ VPC\ Diagram-highlevel\ Architecture.drawio.png)

<a name="cdk"></a>
## Prerequisite
For your ElementalLive encoder to push to the cloud you need to create an IAM User dedicated to each encoder you are using on-prem.
Follow this [documentation](https://docs.aws.amazon.com/elemental-live/latest/ug/setup-live-contribution-to-emx-procedure.html) to create this User and policy.

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
git clone https://github.com/aws-samples/aws-cdk-mediaservices-refarch
```
2. Change directory to the pattern directory:
```bash
cd 
```
3. Install node modules:
```bash
npm install
```

4. Please ensure that you configure for your environment by overriding values in the `config.ts` file before deploying this solution.


5. Deploy Networking Stack
```bash
npm run cdk deploy MediaServicesRefArch-private-network-stack
```

6. Deploy Media Stack
```bash
npm run cdk deploy MediaServicesRefArch-private-media-stack
```

## Running the solution

Once your system is deployed and configured correctly with the right downstream origin/system - you'll need to start the following:
- MediaConnect flow
- MediaLive channel

### Testing
1. Once you have defined your downstream system (i.e. an Origin solution) you will be able to see streams/data being received from MediaLive (upstream).

### Help
- If you delete the network stack, but want to redeploy the solution - ensure you reset the VPC configuration in `cdk.context.json` otherwise it will pick up old configuration (old infrastructure ID's)
```
npm run cdk context --clear
```
If this command doesn't remove the context as expected, manually delete the context content and leave an empty json object, such as:
```
{ }
```
This will ensure that you your VPC and Media stacks will pick up the correct configuration.

### Cleanup
1. Stop Media Live channel

2. Stop MediaConnect Flow

3. Delete the stack
    a. Delete Media Stack first
```
npm run cdk destroy MediaServicesRefArch-private-media-stack
```
    b. Delete Networking stack second, you may have to manually delete a Network Interface for the subnets to be cleared up properly
```
npm run cdk destroy MediaServicesRefArch-private-network-stack
```

<a name="known_issues"></a>
## Known Issues 
1. VPC has an issue where AZ isn't being substitued from dummy1a,dummy1b,dummy1c. This is the implemented workaround, until it is patched https://github.com/aws/aws-cdk/issues/21690#issuecomment-1266201638
2. Stack deletes need to happen in order - see the section above
3. If the stack throws this error when deploying : `ROLLBACK_COMPLETE: One or both the subnets you have specified doesn't exist. Specify a subnet that exists in your VPC.`
Manually remove the contents of `cdk.context.json` file (see Cleanup section - step 3)

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
Content security is key to the success of a streaming platform. So make sure to make use of encryption at rest for your assets with the bucket encryption capabilities and secure the transport of your content with https or s3ssl protocols. Ensure you have authentication and authorization in place at a level commensurate with the sensitivity and regulatory requirements of your assets. Consider using MFA whenever possible to access your resources. Where possible access logging should also be enabled and encrypted.
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
