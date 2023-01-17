# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0


import boto3 as aws
import json

def lambda_handler(event, context):

    print("channel id", event["mediaLiveChannelId"])

    _channel_id = event["mediaLiveChannelId"]
    my_eml = aws.client('medialive')
    try:
        eml_response = my_eml.start_channel(ChannelId=_channel_id)
        print("---------------------------\n",
        "eml response start channel\n",
        json.loads(json.dumps(eml_response, indent=2)))

    except Exception as e:
        print("Error Command - eml start channel " + _channel_id + "failed")
        print(e)

def get_channel_status(channel,medialive):
	" 'State': 'CREATING'|'CREATE_FAILED'|'IDLE'|'STARTING'|'RUNNING'|'RECOVERING'|'STOPPING'|'DELETING'|'DELETED'|'UPDATING'|'UPDATE_FAILED',        "
	info_channel = medialive.describe_channel(
		ChannelId=channel
		)
	return info_channel["State"]