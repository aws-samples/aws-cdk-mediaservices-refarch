#!/bin/bash

#######################################################################################################################
#  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
#
#  Licensed under the Apache License, Version 2.0 (the License"). You may not use this file except in compliance
#  with the License. A copy of the License is located at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
#  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
#  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
#  and limitations under the License.
#######################################################################################################################

# Check if jq is installed
if ! command -v jq &> /dev/null
then
    echo "jq is not installed. Please install jq to proceed."
    exit 1
fi

# Check if a CDK exports file name was provided as a command-line argument
if [ -n "$1" ]; then
    CDK_EXPORTS_FILE="$1"
else
    CDK_EXPORTS_FILE="cdk-exports-event.json"
fi

# Check if the CDK exports file exists in the current directory
if [ -f "$CDK_EXPORTS_FILE" ]; then
    EXPORTS_FILE_PATH="$CDK_EXPORTS_FILE"
# Check if the CDK exports file exists in the parent directory
elif [ -f "../$CDK_EXPORTS_FILE" ]; then
    EXPORTS_FILE_PATH="../$CDK_EXPORTS_FILE"
else
    echo "Error: CDK exports file '$CDK_EXPORTS_FILE' not found in the current or parent directory."
    exit 1
fi

function escapeMediaTailorSessionParam() {
  individualSessionUrl=$1
  echo "$individualSessionUrl" | sed 's/aws\.sessionId=/aws\.sessionId%3D/'
}

escape_url() {
    local url="$1"
    local escaped_url="${url//:/%3A}"  # Escape colon (:)
    escaped_url="${escaped_url//\//%2F}"  # Escape forward slash (/)
    escaped_url="${escaped_url//&/%26}"  # Escape ampersand (&)
    escaped_url="${escaped_url//=/%3D}"  # Escape equal sign (=)
    escaped_url="${escaped_url//\?/%3F}"  # Escape question mark (?)
    echo "$escaped_url"
}

printPlaybackUrls() {
    local export_file="$1"
    local stackname="$2"
    local key_search_string="$3"

    local playbackUrlType="MediaPackage"
    if [[ $key_search_string == *"MediaTailor"* ]]; then
      playbackUrlType="MediaTailor"
    fi

    # Extract list of keys matching key_search_string from export_file
    local matchingKey
    matchingKey=$(jq -r ".$stackname | keys[] | select(contains(\"$key_search_string\"))" "$export_file")

    echo ""
    for key in $matchingKey; do
        # Extract the value of the key
        local value
        value=$(jq -r ".$stackname | .$key" "$export_file")

        # Identify the stream type
        local stream_type="hls-cmaf"
        local printable_stream_type="HLS/CMAF"
        if [[ $value == *".mpd"* ]]; then
          stream_type="dash-cmaf"
          printable_stream_type="DASH/CMAF"
        fi

        # Append mandatory query parameters for MediaTailor URLs
        # if key_search_string contains 'MediaTailor'
        if [[ $playbackUrlType == "MediaTailor" ]]; then
            mediaTailorImplicitSessionInitUrl="${value}?playerParams.content_segment_prefix=${stream_type}&playerParams.ad_segment_prefix=${stream_type}"

            mediaTailorSessionUrlKey=`echo $key | sed 's/PlaybackUrl/SessionUrl/'`

            mediaTailorExplicitSessionInitUrl=$(jq -r ".$stackname.$mediaTailorSessionUrlKey" "$export_file")
        fi

        # Check for corresponding MediaPackage endpoint
        empKey=$(echo "$key" | sed 's/MediaTailorPlaybackUrl/MediaPackagePlaybackUrl/')
        empValue=$(jq -r ".$stackname | .$empKey" "$export_file")

        echo -e "\033[1m$printable_stream_type Stream\033[0m"
        echo -e "\033[1m========================================\033[0m"
        echo -e "\033[1mMediaPackage Playback URL :\033[0m $empValue"
        
        # Generate URLs for Session Initialization UI
        echo -e "\033[1mMediaTailor Session Initialization Demo UI Links:\033[0m"
        echo -e "  \033[1mExplicit Session Initialization:\033[0m https://d195a5eb2n34sr.cloudfront.net?url=$mediaTailorExplicitSessionInitUrl&playerparams=[{\"key\":\"content_segment_prefix\",\"value\":\"$stream_type\"},{\"key\":\"ad_segment_prefix\",\"value\":\"$stream_type\"}]&serverreporting=true"
        echo -e "  \033[1mImplicit Session Initialization:\033[0m https://d195a5eb2n34sr.cloudfront.net?url=$value&playerparams=[{\"key\":\"content_segment_prefix\",\"value\":\"$stream_type\"},{\"key\":\"ad_segment_prefix\",\"value\":\"$stream_type\"}]&serverreporting=true"
        
        # Direct player URLs for testing
        echo -e "\033[1mDirect Player Testing URLs:\033[0m"
        escaped_mediapackage_url=$(escape_url "$empValue")
        escaped_mediatailor_url=$(escape_url "$mediaTailorImplicitSessionInitUrl")
        
        if [[ $stream_type == "dash-cmaf" ]]; then
          echo -e "  \033[1mDASH-IF Reference Player (MediaPackage):\033[0m https://reference.dashif.org/dash.js/nightly/samples/dash-if-reference-player/index.html?mpd=$escaped_mediapackage_url"
          echo -e "  \033[1mDASH-IF Reference Player (MediaTailor):\033[0m https://reference.dashif.org/dash.js/nightly/samples/dash-if-reference-player/index.html?mpd=$escaped_mediatailor_url"
        else
          echo -e "  \033[1mHLS.js Demo Player (MediaPackage):\033[0m https://hls-js.netlify.app/demo/?src=$escaped_mediapackage_url"
          echo -e "  \033[1mHLS.js Demo Player (MediaTailor):\033[0m https://hls-js.netlify.app/demo/?src=$escaped_mediatailor_url"
        fi
        echo ""

    done
}

printUsageInformation() {
    echo -e "\033[1mUsage Information:\033[0m"
    echo -e "========================================="
    echo -e "\033[1mFor Server-Side Ad Insertion:\033[0m"
    echo -e "  - Use MediaTailor URLs with server reporting enabled"
    echo -e "  - Ads are stitched directly into the stream by MediaTailor"
    echo -e "  - Compatible with most video players"
    echo ""
    echo -e "\033[1mFor Content Without Ads:\033[0m"
    echo -e "  - Use MediaPackage URLs directly"
    echo -e "  - Most cost-effective option when no ad insertion is required"
    echo ""
    echo -e "\033[1mTesting Recommendations:\033[0m"
    echo -e "  - Start with MediaPackage URLs to verify content playback"
    echo -e "  - Test server-side insertion with MediaTailor URLs"
    echo -e "  - Use the Session Initialization Demo UI to understand MediaTailor session management"
    echo ""
}

# Extract stackname from CDK_EXPORTS_FILE
stackname=`jq -r 'keys[]' $CDK_EXPORTS_FILE`

echo -e "\033[1mLive Event Framework - Playback URL Generator\033[0m"
echo -e "=============================================="
echo -e "\033[1mStack Name:\033[0m $stackname"
echo -e "\033[1mExports File:\033[0m $CDK_EXPORTS_FILE"

# Print Playback URLs
printPlaybackUrls $CDK_EXPORTS_FILE $stackname MediaTailorPlaybackUrl

# Print usage information
printUsageInformation
