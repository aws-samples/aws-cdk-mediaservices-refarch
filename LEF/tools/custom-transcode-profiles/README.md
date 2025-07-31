# Custom Transode Profiles

Custom ad transcode profiles are not enabled in accounts by default. If you believe you need a custom transcode profile please contact AWS Support and they can provide further guidance.

To setup a custom transcode profile in an AWS account:

1. Raise an AWS Support ticket requesting MediaTailor Custom Transcode Profiles be enabled in your account. In this ticket please include supporting information such as links to the live source and a description of the issue being observed. In some cases AWS Support may provide custom transcode profiles and load them into the account. In these cases steps 2 and/or 3 can be to be skipped.
2. Generate custom transcode profiles using [Encoding Profile Generator](../encoding-profile-generator/README.md)
3. Load custom transcode profiles into AWS account using [Custom Transcode Profile Loader](#custom-transcode-profile-loader).
4. Add a 'transcodeProfiles' section in the event group configuration under eventGroup.mediaTailor. In this configuration specify the custom transcode profiles for 'hlsCmaf' and 'dashCmaf'. Below is an example of the transcodeProfiles configuration using the sample profiles.

   ```typescript
    transcodeProfiles: {
      hlsCmaf: "hd-avc-50fps-sample-mediatailor-hls-cmaf-v1",
      dashCmaf: "hd-avc-50fps-sample-mediatailor-dash-v1"
    },
   ```

   When the 'transcodeProfiles' configuration is enabled on an event group the Live Event Framework:

   - Creates an additional configuration alias on the MediaTailor configuration called 'player_params.transcode_profile'
   - Creates two configuration aliases values for the transcode_profile player parameter and sets these to the corresponding custom profiles from the event group configuration
   - Sets the 'Transcode profile name' on the MediaTailor configuration to '[player_params.transcode_profile]'

   When using MediaTailor Dynamic variables the aliased values must be exhaustive for every player parameter [see here](https://docs.aws.amazon.com/mediatailor/latest/ug/variables-domains.html#dynamic-domains-using-configuration-alias). Because of this condition the 'player*params.transcode_profile' parameter \_must* be specified when establishing a session in an event group with transcode profiles configured.

   For example, to set the transcode profile to the 'hls-cmaf' profile using MediaTailor implicit session initialization the 'playerParams.transcode_profile=hls-cmaf' query parameter would need to be added to the playback URL. For an explicitly initialized session the 'playerParams.transcode_profile=hls-cmaf' value would need to be set in the POST to initialize the session.

**Note:** It is important to increment the version number each time this script is run so the profiles are given a unique name. Custom Transcode Profiles need to use a unique name to ensure ads are retranscoded with the new settings. If a custom transcode profile is uploaded with the same name as an existing profile it will overwrite that profile. However, any ads already transcoded with the original profile will _NOT_ be retranscoded.

<a name="custom-transcode-profile-loader"></a>

## Custom Transode Profile Loader

The **_tools/custom-transcode-profiles/load_custom_transcode_profiles.py_** script simplifies the loading of custom transcode profiles into your AWS account.
The script needs to be run from a command line with an appropriately configured [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-configure.html).

Below are the example commands to load the sample custom transcode profiles into your account before attempting to deploy the CDK stacks.

```bash
# Create Python virtual environment to run scripts (if local Python is not being used)
python3 -m venv .venv
source .venv/bin/activate
pip install -r tools/requirements.txt

# Load MediaTailor DASH-CMAF Custom Transcode profile
# Required parameters:
#   --profile-path: Path to the directory containing encoding profiles
# Optional parameters:
#   --profile_name: Name of the profile to load
#   --profile: AWS CLI profile name
#   --region: AWS region name
tools/custom-transcode-profiles/load_custom_transcode_profiles.py \
    --profile-path encoding-profiles/hd-avc-50fps-sample/mediatailor-dash-v1.json

# Load MediaTailor HLS-CMAF Custom Transcode profile
tools/custom-transcode-profiles/load_custom_transcode_profiles.py \
    --profile-path encoding-profiles/hd-avc-50fps-sample/mediatailor-hls-cmaf-v1.json
```
