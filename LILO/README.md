# LILO: Live encoding loop
## Log
| Date        | Entry   | Version | Comment                             |
|-------------|:-------:|:-------:|-------------------------------------|
| 15/11/2021  | created | 0.0.1   | initial release of the application  | 


## Disclaimer 

The sample code; software libraries; command line tools; proofs of concept; templates; or other related technology is provided to you as AWS Content under the AWS Customer Agreement, or the relevant written agreement between you and AWS (whichever applies). You are responsible for testing, securing, and optimizing the AWS Content, such as sample code, as appropriate for production grade use based on your specific quality control practices and standards. You should not use this AWS Content in your production accounts, or on production or other critical data. Deploying AWS Content may incur AWS charges for creating or using AWS chargeable resources, such as running AWS Elemental Live Channels or using AWS Elemental MediaPackage.



## Table of content
- [Solution overview](#solution)
- [Use case](#use_case)
- [Architecture](#architecture)
- [CDK structure](#cdk)
- [Deployment](#deployment)
- [Best practice](#best_practice)
- [Known issues](#known_issues)
- [File structure](#files_structure)
- [License](#license)


<a name="solution"></a>
## Solution
The live encoding loop solution is intended to provide you with ready to use application that will build a live channel.

The generated channel can then be used for testing and debugging purposes and allowing you to familiarise yourself with building and writing media infrastructure as code.

This solution will build for you a media infrastructure that will create a channel that plays an MP4 file in a continuous loop simulating a live channel. 

While deploying this code you will be making use of the following services which could incur charges in your account:
  - [Simple Storage Service (S3)](https://aws.amazon.com/s3/pricing/?trkCampaign=acq_paid_search_brand&sc_channel=PS&sc_campaign=acquisition_FR&sc_publisher=Google&sc_category=Storage&sc_country=FR&sc_geo=EMEA&sc_outcome=acq&sc_detail=aws%20s3%20pricing&sc_content={ad%20group}&sc_matchtype=e&sc_segment=536324523594&sc_medium=ACQ-P|PS-GO|Brand|Desktop|SU|Storage|S3|FR|EN|Sitelink&s_kwcid=AL!4422!3!536324523594!e!!g!!aws%20s3%20pricing&ef_id=Cj0KCQjwg7KJBhDyARIsAHrAXaFy_yM-1k-3RMbL6CbfZfF8nmb2PutDkI7IA8R_YAs507q20CpP35EaAn5NEALw_wcB:G:s&s_kwcid=AL!4422!3!536324523594!e!!g!!aws%20s3%20pricing)
  - [Medialive (EML)](https://aws.amazon.com/medialive/pricing/)
  - [CloudFormation (CFN)](https://aws.amazon.com/cloudformation/pricing/)


<a name="use_case"></a>
## Use case
- Audience:
  - Any AWS account owner with technical and non technical skills interested in exploring/deploying streaming services

- Scope:
  - This solution can apply in the following situations:
    - Configuration/testing/debugging purposes
    - Ingest decoupling
    - VOD to Live workflows
    - Play a file in Loop Mode

- Pre-requisites: 
  - Own access to an AWS account
  - Confirm CloudTrail trail is up and running on the account
  - Have access to a machine with a terminal (or use [AWS Cloud9](https://aws.amazon.com/cloud9/) which is the preferred way to deploy this application)
  - Set up AWS CLI v2 (or use [AWS Cloud9](https://aws.amazon.com/cloud9/) which is the preferred way to deploy this application)
  - Have access rights to IAM, S3, EML, CFN
  - Avail MP4 content on S3
  - Define a publication IP and port for your RTP output


<a name="architecture"></a>
## Architecture
Here is the architecture diagram for this application
![Live to archive architecture](images/LILO.png)
- assets: 
  - Prepare your content
  - Make sure it is available in MP4 format
  - Supported video codec:
    - MPEG-2
    - H.264 (AVC)
    - H.265 (HEVC)
  - Audio codec: 
    - AAC
  - refer to the [inputs supported containers and codecs](https://docs.aws.amazon.com/medialive/latest/ug/inputs-supported-containers-and-codecs.html) for more information
- simple storage service:
  - make sure you correctly set up your permission to S3 bucket and objects
  - make sure you have some content available on the bucket 
  - *alternatively you can use a public owned HTTP origin to provide access to your content*  
- medialive:
  - review code for best practice configuration


<a name="cdk"></a>
## CDK 
Visit our [AWS cloud Development Kit](https://aws.amazon.com/cdk/) for more information on CDK
Get hands-on with CDK running the [CDK introduction workshop](https://cdkworkshop.com/30-python.html)


For this project we will make use of [Python version of CDK](CDK-README.md). 
We will create a Python app using CDK, this app will abstract all the CloudFormation stack and resource creation. 
The application code will be structured as follows: 
* core stack
* permission stack
* automation stack 
* mediaservices stack

The core stack is aimed to contain shared resources 
The other stacks will be nested to the core stack and have their own domain of speciality

1. The permission stack will hold the roles and policies required to run the application
1. The automation stack will host the lambda function and, the eventbridge triggers necessary 
1. The mediaservices stack will handle the deployment of all the components to the media infrastructure 

More information on [CDK best practice](https://docs.aws.amazon.com/cdk/latest/guide/best-practices.html#best-practices-apps) can be found on AWS website. 

<a name="deploy"></a>
## Deployment
### Customize your script

Pick up the region where you want to run the solution
  - Save the S3 path to your content, example:
    `s3ssl://bucket/path/file.mp4`
  - Choose the name of your stack
  - Select a name for your channel
  - Define your IP and port for your RTP output 


From your favorite IDE (or Cloud9) open the file app.py and update the following variables:
  - my_region 
  - my_stack_name 
  - my_customer_name
  - channel_name
  - source
  - destination
  - port


The following optional additional parameters are available:
  - Auto start: allow the channel to start as soon as resources are provisioned 


### Process
  - scripted
    - deploy:
      1. clone the repository
      1. move in created folder   
      1. run the deployment script with the deploy option
    - destroy 
      1. run the deployment script with the destroy option
  - manual: 
    - deploy:
      1. clone the repository 
      1. move in created folder   
      1. create environment variable   
      1. create a new folder that will contain your app
      1. move into the newly created app folder
      1. generate a new cdk app
      1. set up option to allow moving of hidden files
      1. move the content of your cloned repository to your app folder
      1. remove the original folder generated by git
      1. activate your virtual environment
      1. install dependencies
      1. bootstraap your CDK environment
      1. deploy the application by running the CDK deploy command
    -destroy:
      1. move into your app folder
      1. destroy the application by running the CDK destroy command


### Scripted for bash terminal
  - deploy:
    1. `git clone "https://github.com/aws-samples/aws-cdk-mediaservices-refarch"`
    1. `cd aws-cdk-mediaservices-refarch/`   
    1. `bash ./LILO/run.sh -a deploy`
  - destroy:
    1. `bash ./app/run.sh -a destroy`


### Manual deployment: 
  - deploy:
    1. `git clone "https://github.com/aws-samples/aws-cdk-mediaservices-refarch"`
    1. `cd aws-cdk-mediaservices-refarch/`   
    1. `LILOPATH=${pwd}`
    1. `mkdir $LILOPATH/app`
    1. `cd $LILOPATH/app`
    1. `cdk init app --language=python`
    1. `shopt -s dotglob nullglob`
    1. `mv $LILOPATH/LILO/* $LILOPATH/app/`
    1. `rm -Rf $LILOPATH/LILO`
    1. `source .venv/bin/activate`
    1. `pip install -r requirements.txt`
    1. `cdk bootstrap`
    1. `cdk deploy --require-approval never`
  - destroy: 
    1. `cd $LILOPATH/app/`
    1. `source .venv/bin/activate`
    1. `cdk destroy -f`


<a name="best_practice"></a>
## Best practice
* **Security**:

&nbsp;&nbsp;&nbsp;Content security is key to the success of a streaming platform. So make sure to make use of encryption at rest for your assets with the bucket encryption capabilities and secure the transport of your content with https or s3ssl protocols. 
* **Reliability**: 

&nbsp;&nbsp;&nbsp;For demos and debugging purpose this solution run a single pipeline to process your content. 

&nbsp;&nbsp;&nbsp;However, in a production environment make sure to remove any single point of failure by using the STANDARD mode  which allows for dual pipeline creation to process your content in the cloud. 
* **Operation**: 

&nbsp;&nbsp;&nbsp;Enabling logs on the channel will give you more insight on what is happening in your infrastructure should you need to investigate any issue.

&nbsp;&nbsp;&nbsp;You can enhance your CDK application with API calls to automate operational tasks based on triggers. 
* **Cost**: 

&nbsp;&nbsp;&nbsp;Review your encoding settings to optimize your ABR ladder.

&nbsp;&nbsp;&nbsp;Consider reservation for 24/7 workflow.

&nbsp;&nbsp;&nbsp;Make use of bandwidth optimized control rate such as QVBR to save bandwidth on CDN usage when possible.


<a name="known_issues"></a>
## Known Issues 
### Operation:
Please make sure the associated channel is in idle state before running the destroy command. 

You can check your channel status by logging in to your AWS console ==> MediaLive ==> Channel

Once on the MediaLive Channel dashboard identify your channel and tick the box on the left side of the channel list. 

Then click on the button stop and wait for the channel to be in idle state before you proceed with the destroy command. 

<a name="files"></a>
## Files structure

The Live encoding loop solution consist of: 

<pre>
|- app
|   |- run.sh                    [ Script for deploying the LILO application]
|   |- app.py                    [ Core application script]
|   |- setup.py                  [ Application dependency list]
|- lilo
|   |- iam_nested_stack.py                [ IAM nested stack to manage access and permission of the application ]
|   |- lilo_automation_nested_stack.py    [ Lambda function hosting and event bridge triggers management ]
|   |- lilo_stack.py                      [ Core application stack ]
|   |- medialive_nested_stack.py          [ MediaServices configuration stack ]
|   |- lambda                             
|   |   |- medialive_channel_start_function.py    [ Python code to automatically start the MediaLive channel upon successful create ]
|- images
    |- LILO.png                          [ Architecture diagram ]
</pre>


<a name="license"></a>
## License

This library is licensed under the MIT-0 License. See the LICENSE file.
