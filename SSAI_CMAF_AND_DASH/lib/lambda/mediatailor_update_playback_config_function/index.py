# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0
import json
import boto3
from pprint import pprint

client = boto3.client('mediatailor')

def lambda_handler(event, context):

    print('request: {}'.format(json.dumps(event)))

    props = event["ResourceProperties"]
    playbackConfigurationName = props["playbackConfigurationArn"].split('/')[-1]
    adSegmentUrlPrefix        = props["adSegmentUrlPrefix"]
    contentSegmentUrlPrefix   = props["contentSegmentUrlPrefix"]
    customTranscodeProfile    = None
    if "customTranscodeProfile" in props.keys() and props["customTranscodeProfile"] not in ["","null",None]:
        customTranscodeProfile = props["customTranscodeProfile"]

    physicalResourceId = "%s_update" % playbackConfigurationName
    returnValue = {
        "Status": "SUCCESS",
        "Reason": "OK",
        "LogicalResourceId": event["LogicalResourceId"],
        "PhysicalResourceId": physicalResourceId,
        "RequestId": event["RequestId"],
        "StackId": event["StackId"]
    }

    # Only need to execute lambda if this is a stack create or update
    # For other request types just return success
    if event["RequestType"] not in ["Create", "Update"]:
        print("No action required")
        return returnValue

    # Retrieve Playback Configuration
    try:
        response = client.get_playback_configuration(
            Name=playbackConfigurationName
        )
    except Exception as e:
        raise(e)

    print("Successfully retrieved Playback Configuration")

    playbackConfiguration = response

    # Remove parameters from response that are not supported by put_playback_configuration
    responseParamsToRemove = ["ResponseMetadata",
                              "DashConfiguration",
                              "HlsConfiguration",
                              "PlaybackConfigurationArn",
                              "PlaybackEndpointPrefix",
                              "SessionInitializationEndpointPrefix"]
    for param in responseParamsToRemove:
        del playbackConfiguration[param]

    # Set ad segment prefix
    if adSegmentUrlPrefix:
        playbackConfiguration["CdnConfiguration"]["AdSegmentUrlPrefix"] = adSegmentUrlPrefix

    # Set content segment prefix
    if contentSegmentUrlPrefix:
        playbackConfiguration["CdnConfiguration"]["ContentSegmentUrlPrefix"] = contentSegmentUrlPrefix

    # Set custom transcode profile
    if customTranscodeProfile:
        playbackConfiguration["TranscodeProfileName"] = customTranscodeProfile


    # Update Playback Configuration
    pprint(playbackConfiguration)
    try:
        response = client.put_playback_configuration( **playbackConfiguration)
    except Exception as e:
        raise(e)

    print("Successfully updated Playback Configuration")
    return returnValue
