# Encoding Profile Generator

The **_tools/encoding-profile-generator/generate_encoding_profile_set.py_** script reads a yaml configuration containing the adaptive bitrate
ladder settings and generates the following output encoding profiles:

- MediaLive HLS/TS
- MediaLive CMAF Ingest
- MediaLive MediaPackage (NEW)
- MediaTailor HLS/CMAF Custom Transcode Profile
- MediaTailor DASH/CMAF Custom Transcode Profile

This script endeavours to produce custom transcode profiles to minimise issues as players transition in and out of ad breaks. The script only supports a limited number of output codecs and is not intended to support the full range of MediaLive / MediaConvert profiles settings.

## Output Group Types

The generator now supports three MediaLive output group types:

1. **HLS/TS** (`medialive-hls-ts`) - Legacy MediaPackage V1 output groups
2. **CMAF Ingest** (`medialive-cmaf-ingest`) - Direct ingest to MediaPackage V2 channels
3. **MediaPackage** (`medialive-mediapackage`) - MediaPackage V2 output groups (NEW)

### MediaPackage Output Groups

The new MediaPackage output group type provides a direct integration path between MediaLive and MediaPackage V2, offering:

- Simplified configuration compared to HLS/TS output groups
- Better integration with MediaPackage V2 features
- Reduced complexity in the streaming pipeline

**Note:** MediaPackage output groups do not support FRAME_CAPTURE renditions. These will be automatically excluded from generated profiles.

Below is an example command to generate a sample set of profiles based on the configuration in **encoding-profiles/profile-generator-configs/hd-avc-50fps-sample.yaml**. This is the command which was used to generate the profiles in **encoding-profiles/sample-profiles**.

```bash
# Create Python virtual environment to run scripts (if local Python is not being used)
python3 -m venv .venv
source .venv/bin/activate
pip install -r tools/requirements.txt

# Regenerate the hd-avc-50fps-sample profiles (version number should be incremented)
tools/encoding-profile-generator/generate_encoding_profile_set.py --config tools/encoding-profile-generator/sample-configs/hd-avc-50fps-sample.yaml \
        --version 1 \
        --output-path encoding-profiles

# Regenerate the low-latency-hd-avc-50fps-sample profiles (version number should be incremented)
tools/encoding-profile-generator/generate_encoding_profile_set.py --config tools/encoding-profile-generator/sample-configs/low-latency-hd-avc-50fps-sample.yaml \
        --version 1 \
        --output-path encoding-profiles
```
