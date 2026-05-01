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
elif [ -f "cdk-exports-event.json" ]; then
    CDK_EXPORTS_FILE="cdk-exports-event.json"
elif [ -f "cdk-exports-all.json" ]; then
    CDK_EXPORTS_FILE="cdk-exports-all.json"
else
    echo "Error: No exports file specified and none of the default files (cdk-exports-event.json/cdk-exports-all.json) exist."
    exit 1
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

echo "Using CDK exports file: $EXPORTS_FILE_PATH"

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

printMediaTailorUrls() {
    local export_file="$1"
    local stackname="$2"
    local hls_key="$3"
    local dash_key="$4"
    local config_label="$5"

    # Get HLS and DASH URLs
    local hls_url=$(jq -r ".$stackname | .$hls_key" "$export_file" 2>/dev/null)
    local dash_url=$(jq -r ".$stackname | .$dash_key" "$export_file" 2>/dev/null)

    # Skip if URLs don't exist or are null
    if [[ "$hls_url" == "null" || "$dash_url" == "null" || -z "$hls_url" || -z "$dash_url" ]]; then
        return
    fi

    # Get corresponding session URLs
    local hls_session_key=$(echo "$hls_key" | sed 's/HlsPlaybackPrefix/SessionPrefix/')
    local dash_session_key=$(echo "$dash_key" | sed 's/DashPlaybackPrefix/SessionPrefix/')
    local hls_session_url=$(jq -r ".$stackname | .$hls_session_key" "$export_file" 2>/dev/null)
    local dash_session_url=$(jq -r ".$stackname | .$dash_session_key" "$export_file" 2>/dev/null)

    # Get corresponding MediaPackage URLs to extract the channel path
    local hls_mp_key="cmafEndpointhlsManifestsindexMediaPackagePlaybackUrl"
    local dash_mp_key="cmafEndpointdashManifestsdashMediaPackagePlaybackUrl"
    local hls_mp_url=$(jq -r ".$stackname | .$hls_mp_key" "$export_file" 2>/dev/null)
    local dash_mp_url=$(jq -r ".$stackname | .$dash_mp_key" "$export_file" 2>/dev/null)

    # Extract MediaPackage paths from MediaPackage URLs
    local hls_mp_path=""
    local dash_mp_path=""
    if [[ "$hls_mp_url" != "null" && -n "$hls_mp_url" ]]; then
        hls_mp_path=$(echo "$hls_mp_url" | sed 's|https://[^/]*/||')
    fi
    if [[ "$dash_mp_url" != "null" && -n "$dash_mp_url" ]]; then
        dash_mp_path=$(echo "$dash_mp_url" | sed 's|https://[^/]*/||')
    fi

    echo ""
    echo -e "\033[1m=== $config_label MediaTailor Configuration ===\033[0m"
    echo ""

    # Print HLS URLs
    if [[ "$hls_url" != "null" && -n "$hls_url" && -n "$hls_mp_path" ]]; then
        local hls_complete_url="${hls_url}${hls_mp_path}"
        local hls_implicit_url="${hls_complete_url}?playerParams.content_segment_prefix=hls-cmaf&playerParams.ad_segment_prefix=hls-cmaf"
        local hls_explicit_url="${hls_session_url}${hls_mp_path}"

        echo -e "\033[1mHLS/CMAF Stream\033[0m"
        echo -e "\033[1m========================================\033[0m"
        if [[ "$hls_mp_url" != "null" && -n "$hls_mp_url" ]]; then
            echo -e "\033[1mMediaPackage Playback URL :\033[0m $hls_mp_url"
        fi
        echo -e "\033[1mMediaTailor Session Initialization Demo UI Links:\033[0m"
        echo -e "  \033[1mExplicit Session Initialization:\033[0m https://d195a5eb2n34sr.cloudfront.net?url=$hls_explicit_url&playerparams=[{\"key\":\"content_segment_prefix\",\"value\":\"hls-cmaf\"},{\"key\":\"ad_segment_prefix\",\"value\":\"hls-cmaf\"}]&serverreporting=true"
        echo -e "  \033[1mImplicit Session Initialization:\033[0m https://d195a5eb2n34sr.cloudfront.net?url=$hls_implicit_url&playerparams=[{\"key\":\"content_segment_prefix\",\"value\":\"hls-cmaf\"},{\"key\":\"ad_segment_prefix\",\"value\":\"hls-cmaf\"}]&serverreporting=true"
        
        echo -e "\033[1mDirect Player Testing URLs:\033[0m"
        if [[ "$hls_mp_url" != "null" && -n "$hls_mp_url" ]]; then
            local escaped_hls_mp_url=$(escape_url "$hls_mp_url")
            echo -e "  \033[1mHLS.js Demo Player (MediaPackage):\033[0m https://hls-js.netlify.app/demo/?src=$escaped_hls_mp_url"
        fi
        local escaped_hls_mt_url=$(escape_url "$hls_implicit_url")
        echo -e "  \033[1mHLS.js Demo Player (MediaTailor):\033[0m https://hls-js.netlify.app/demo/?src=$escaped_hls_mt_url"
        echo ""
    fi

    # Print DASH URLs
    if [[ "$dash_url" != "null" && -n "$dash_url" && -n "$dash_mp_path" ]]; then
        local dash_complete_url="${dash_url}${dash_mp_path}"
        local dash_implicit_url="${dash_complete_url}?playerParams.content_segment_prefix=dash-cmaf&playerParams.ad_segment_prefix=dash-cmaf"
        local dash_explicit_url="${dash_session_url}${dash_mp_path}"

        echo -e "\033[1mDASH/CMAF Stream\033[0m"
        echo -e "\033[1m========================================\033[0m"
        if [[ "$dash_mp_url" != "null" && -n "$dash_mp_url" ]]; then
            echo -e "\033[1mMediaPackage Playback URL :\033[0m $dash_mp_url"
        fi
        echo -e "\033[1mMediaTailor Session Initialization Demo UI Links:\033[0m"
        echo -e "  \033[1mExplicit Session Initialization:\033[0m https://d195a5eb2n34sr.cloudfront.net?url=$dash_explicit_url&playerparams=[{\"key\":\"content_segment_prefix\",\"value\":\"dash-cmaf\"},{\"key\":\"ad_segment_prefix\",\"value\":\"dash-cmaf\"}]&serverreporting=true"
        echo -e "  \033[1mImplicit Session Initialization:\033[0m https://d195a5eb2n34sr.cloudfront.net?url=$dash_implicit_url&playerparams=[{\"key\":\"content_segment_prefix\",\"value\":\"dash-cmaf\"},{\"key\":\"ad_segment_prefix\",\"value\":\"dash-cmaf\"}]&serverreporting=true"
        
        echo -e "\033[1mDirect Player Testing URLs:\033[0m"
        if [[ "$dash_mp_url" != "null" && -n "$dash_mp_url" ]]; then
            local escaped_dash_mp_url=$(escape_url "$dash_mp_url")
            echo -e "  \033[1mDASH-IF Reference Player (MediaPackage):\033[0m https://reference.dashif.org/dash.js/nightly/samples/dash-if-reference-player/index.html?mpd=$escaped_dash_mp_url"
        fi
        local escaped_dash_mt_url=$(escape_url "$dash_implicit_url")
        echo -e "  \033[1mDASH-IF Reference Player (MediaTailor):\033[0m https://reference.dashif.org/dash.js/nightly/samples/dash-if-reference-player/index.html?mpd=$escaped_dash_mt_url"
        echo ""
    fi
}

printUsageInformation() {
    echo -e "\033[1mUsage Information:\033[0m"
    echo -e "========================================="
    echo -e "\033[1mConfiguration Types:\033[0m"
    echo -e "  - \033[1mEvent Group MediaTailor:\033[0m Shared configurations used by all events in the group"
    echo -e "  - \033[1mEvent-Specific MediaTailor:\033[0m Custom configurations defined per event"
    echo ""
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
    echo -e "  - When multiple MediaTailor configurations exist, test each one for different ad scenarios"
    echo ""
}

# Extract stackname from CDK_EXPORTS_FILE
# If multiple stacks exist (deploy-all), find the Event stack
all_stacks=`jq -r 'keys[]' $CDK_EXPORTS_FILE`
stackname=""

# Check if there are multiple stacks
stack_count=$(echo "$all_stacks" | wc -l | tr -d ' ')

if [ "$stack_count" -gt 1 ]; then
    # Multiple stacks - find the Event stack (has MediaPackage playback URLs)
    for stack in $all_stacks; do
        if jq -e ".$stack | keys[] | select(endswith(\"MediaPackagePlaybackUrl\"))" "$CDK_EXPORTS_FILE" >/dev/null 2>&1; then
            stackname="$stack"
            break
        fi
    done
    
    if [ -z "$stackname" ]; then
        echo "Error: Could not identify Event stack in exports file with multiple stacks."
        echo "Available stacks: $all_stacks"
        exit 1
    fi
else
    # Single stack
    stackname="$all_stacks"
fi

echo -e "\033[1mLive Event Framework - Playback URL Generator\033[0m"
echo -e "=============================================="
echo -e "\033[1mStack Name:\033[0m $stackname"
echo -e "\033[1mExports File:\033[0m $CDK_EXPORTS_FILE"

# Check for event-specific MediaTailor configurations first (these take precedence)
event_mt_found=false
if jq -e ".$stackname | has(\"MediaTailorHlsPlaybackPrefix\")" "$CDK_EXPORTS_FILE" >/dev/null 2>&1; then
    printMediaTailorUrls "$CDK_EXPORTS_FILE" "$stackname" "MediaTailorHlsPlaybackPrefix" "MediaTailorDashPlaybackPrefix" "Event-Specific Primary"
    event_mt_found=true
fi

# Check for additional named event-specific configurations
named_configs=$(jq -r ".$stackname | keys[] | select(test(\"^MediaTailorHlsPlaybackPrefix-.+$\"))" "$CDK_EXPORTS_FILE" 2>/dev/null)
for hls_key in $named_configs; do
    config_name=$(echo "$hls_key" | sed 's/MediaTailorHlsPlaybackPrefix-//')
    dash_key="MediaTailorDashPlaybackPrefix-$config_name"
    printMediaTailorUrls "$CDK_EXPORTS_FILE" "$stackname" "$hls_key" "$dash_key" "Event-Specific ($config_name)"
    event_mt_found=true
done

# If no event-specific MediaTailor found, look for event group MediaTailor (legacy format)
if [ "$event_mt_found" = false ]; then
    # Look for legacy MediaTailor playback URLs (from event group)
    legacy_keys=$(jq -r ".$stackname | keys[] | select(test(\".*MediaTailorPlaybackUrl$\"))" "$CDK_EXPORTS_FILE" 2>/dev/null)
    if [ -n "$legacy_keys" ]; then
        echo ""
        echo -e "\033[1m=== Event Group MediaTailor Configuration (Legacy Format) ===\033[0m"
        for key in $legacy_keys; do
            value=$(jq -r ".$stackname | .$key" "$CDK_EXPORTS_FILE")
            
            stream_type="hls-cmaf"
            printable_stream_type="HLS/CMAF"
            if [[ $value == *".mpd"* ]]; then
                stream_type="dash-cmaf"
                printable_stream_type="DASH/CMAF"
            fi

            mediaTailorImplicitSessionInitUrl="${value}?playerParams.content_segment_prefix=${stream_type}&playerParams.ad_segment_prefix=${stream_type}"
            mediaTailorSessionUrlKey=$(echo $key | sed 's/PlaybackUrl/SessionUrl/')
            mediaTailorExplicitSessionInitUrl=$(jq -r ".$stackname.$mediaTailorSessionUrlKey" "$CDK_EXPORTS_FILE")

            empKey=$(echo "$key" | sed 's/MediaTailorPlaybackUrl/MediaPackagePlaybackUrl/')
            empValue=$(jq -r ".$stackname | .$empKey" "$CDK_EXPORTS_FILE")

            echo ""
            echo -e "\033[1m$printable_stream_type Stream\033[0m"
            echo -e "\033[1m========================================\033[0m"
            echo -e "\033[1mMediaPackage Playback URL :\033[0m $empValue"
            echo -e "\033[1mMediaTailor Session Initialization Demo UI Links:\033[0m"
            echo -e "  \033[1mExplicit Session Initialization:\033[0m https://d195a5eb2n34sr.cloudfront.net?url=$mediaTailorExplicitSessionInitUrl&playerparams=[{\"key\":\"content_segment_prefix\",\"value\":\"$stream_type\"},{\"key\":\"ad_segment_prefix\",\"value\":\"$stream_type\"}]&serverreporting=true"
            echo -e "  \033[1mImplicit Session Initialization:\033[0m https://d195a5eb2n34sr.cloudfront.net?url=$value&playerparams=[{\"key\":\"content_segment_prefix\",\"value\":\"$stream_type\"},{\"key\":\"ad_segment_prefix\",\"value\":\"$stream_type\"}]&serverreporting=true"
            
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
    else
        echo ""
        echo -e "\033[1;33mNo MediaTailor configurations found. Only MediaPackage endpoints are available.\033[0m"
        
        # Show MediaPackage URLs only
        mp_keys=$(jq -r ".$stackname | keys[] | select(test(\".*MediaPackagePlaybackUrl$\"))" "$CDK_EXPORTS_FILE" 2>/dev/null)
        for key in $mp_keys; do
            value=$(jq -r ".$stackname | .$key" "$CDK_EXPORTS_FILE")
            
            stream_type="HLS/CMAF"
            if [[ $value == *".mpd"* ]]; then
                stream_type="DASH/CMAF"
            fi
            
            echo ""
            echo -e "\033[1m$stream_type Stream (MediaPackage Only)\033[0m"
            echo -e "\033[1m========================================\033[0m"
            echo -e "\033[1mMediaPackage Playback URL :\033[0m $value"
        done
    fi
fi

# Print usage information
printUsageInformation
