# Configuring Workflow to use Elemental Live Appliances

The [default event configuration](../../config/default/eventConfiguration.ts) creates a workflow using MediaLive to encode the live stream. The Live Event Framework also supports workflows using Elemental Live Appliances. Figure 1 below shows the Live Event Framework architecture using Elemental Live rather than MediaLive as the encoder. Using the Live Event Framework it is possible to deploy events using MediaLive, MediaLive Anywhere and Elemental Live encoders into the same channel group.

![Live Event Framework Architecture Diagram using AWS Elemental Live](../../resources/ArchitectureDiagram-ElementalLive.png)

**Figure 1. Live Event Framework Architecture Diagram using AWS Elemental Live**

For an Elemental Live appliance to push a stream to a MediaPackage V2 channel:

1. The Elemental Live event needs to be configured with the:
   - Access Key for an IAM user with permissions to 'mediapackagev2:PutObject'
   - destination URIs for the MediaPackage Channel ingest endpoints - When an event stack is deployed with an Elemental Live configuration these values are provided as CloudFormation stack outputs called **MediaPackageChannelIngestEndpoint1** and **MediaPackageChannelIngestEndpoint2**.
2. The MediaPackage V2 Channel Policy needs to be configured to accept content from the IAM user configured on the Elemental Live Appliance

## Creating IAM User for Elemental Live events

The **_tools/elemental-live/create_elemental_live_user.py_** script simplifies the creation of an IAM user with the permissions required to push a stream to the MediaPackage Channel. This script will create an IAM User and output an AWS Access Key to be configured in the Elemental Live Appliance. This IAM user has permission to push a stream to any MediaPackage V2 channel in the specified account and region. In some situations it may be advisable to create an IAM user for each Elemental Live event and only give the IAM user permission to push to a specific MediaPackage V2 channel rather than all channels. This is the recommended approach from the MediaPackage V2 [Ingest authorization documentation](https://docs.aws.amazon.com/mediapackage/latest/userguide/ingest-auth.html). One downside of this approach is each Elemental Live event needs to be configured with unique credentials and a new IAM user is required for each MediaPackage Channel.

Below are the example commands to create an elemental live user in your account using the **_tools/create_elemental_live_user.py_** script.

```bash
# Create Python virtual environment to run scripts (if local Python is not being used)
python3 -m venv .venv
source .venv/bin/activate
pip install -r tools/requirements.txt

# Create Elemental Live User
tools/elemental-live/create_elemental_live_user.py --username ElementalLive1  [--profile AWS_PROFILE] [--region AWS_REGION]
```

The script requires confirmation of the account ID and region where the user will be created before proceeding. The output will look similar to the below example:

```shell
Created IAM User Details:
  User ARN:		arn:aws:iam::012345678910:user/ElementalLive1
  AccessKeyId:		AKIAIOSFODNN7EXAMPLE
  SecretAccessKey:	wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

#### Configuring Live Event Framework Event Stack for Elemental Live Input

To configure an event stack to use Elemental Live rather than MediaLive the event stack configuration file (default is 'config/eventConfiguration.yaml') needs to be modified.
The event stack configuration can include configuration for either 'mediaLive' or 'elementalLive' (not both).
Below is an example 'elementalLive' configuration.

```yaml
elementalLive:
  userArn: arn:aws:iam::012345678910:user/ElementalLive1
  inputCidr:
    - xxx.xxx.xxx.xxx/xx
    - yyy.yyy.yyy.yyy/yy
```

The **userArn** (mandatory) is the ARN from the user created in the step above. The event stack includes the userArn in the MediaPackage channel policy to grant permissions for this user to push content to the MediaPackage Channel.

The **inputCidr** (optional, but recommended) specifies a list of CIDR blocks the MediaPackage channel policy will allow to push content to the MediaPackage channel. When specified requests to the MediaPackage channel from outside the specified CDIR blocks will be denied access. Specifying the 'inputCidr' value is recommended in cases where the Elemental Live appliances are deployed in a network with fixed IP ranges.
