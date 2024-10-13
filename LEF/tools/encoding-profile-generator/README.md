# Encoding Profile Generator

The **_tools/encoding-profile-generator/generate_encoding_profile_set.py_** script reads a yaml configuration containing the adaptive bitrate
ladder settings and generates the following output encoding profiles:

- MediaLive HLS/TS
- MediaTailor HLS/CMAF Custom Transcode Profile
- MediaTailor DASH/CMAF Custom Transcode Profile

This script endeavours to produce custom transcode profiles to minimise issues as players transition in and out of ad breaks. The script only supports a limited number of output codecs and is not intended to support the full range of MediaLive / MediaConvert profiles settings.

Below is an example command to generate a sample set of profiles based on the configuration in **encoding-profiles/profile-generator-configs/hd-avc-50fps-sample.yaml**. This is the command which was used to generate the profiles in **encoding-profiles/sample-profiles**.

```bash
# Create Python virtual environment to run scripts (if local Python is not being used)
python3 -m venv .venv
source .venv/bin/activate
pip install -r tools/requirements.txt

tools/encoding-profile-generator/generate_encoding_profile_set.py --config encoding-profiles/profile-generator-configs/hd-avc-50fps-sample.yaml \
        --version 1 \
        --output-path encoding-profiles/my-encoding-profiles
```
