#!/bin/bash

#######################################################################################################################
#  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
#
#  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
#  with the License. A copy of the License is located at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
#  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
#  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
#  and limitations under the License.
#######################################################################################################################

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

# Extract values from the CDK exports file
export MediaLiveChannelId=$(grep 'MediaLiveChannelArn' < "$EXPORTS_FILE_PATH" | awk -F'"' '{print $4}' | grep -oE "[^:]+$")

echo "Stopping MediaLive Channel:" $MediaLiveChannelId

# Check if AWS_PROFILE is defined
if [ -n "$AWS_PROFILE" ]; then
    PROFILE_ARG="--profile $AWS_PROFILE"
else
    PROFILE_ARG=""
fi

# Check if the channel exists
CHANNEL_STATUS=$(aws --no-cli-pager medialive describe-channel --channel-id $MediaLiveChannelId $PROFILE_ARG --query "State" --output text 2>&1)

if [[ $CHANNEL_STATUS == *"NotFoundException"* ]]; then
    echo "Error: Channel $MediaLiveChannelId does not exist"
    exit 1
fi

StopMediaLive=$(aws --no-cli-pager medialive stop-channel --channel-id $MediaLiveChannelId $PROFILE_ARG)

# Wait for the channel to stop
while true ; do
    CHANNEL_STATUS=$(aws --no-cli-pager medialive describe-channel --channel-id $MediaLiveChannelId $PROFILE_ARG --query "State" --output text)
    if [ "$CHANNEL_STATUS" == "IDLE" ]; then
        echo "Channel $MediaLiveChannelId is stopped"
        break
    else
        echo "Channel $MediaLiveChannelId is not stopped"
    fi
    sleep 5
done
