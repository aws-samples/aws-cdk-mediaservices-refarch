# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

# author:       Emmanuel Etheve
# email:        ethevee@amazon.com
# description:  This code contain the python script to automatically start a channel upon successful creation
# created:      02/07/2021 (dd/mm/yyyy)
# modified:     30/08/2021 (dd/mm/yyyy)
# filename:     medialive_channel_start_function.py

import boto3 as aws
import json
import time

def medialive_channel_start_function(event, context):

    time.sleep(50)
    print("---------------------------\n",
          "event\n",
          json.loads(json.dumps(event, indent=2)))
    # print(json.dumps(context, indent=2))

    print("state", json.loads(json.dumps(event, indent=2))["detail"]["state"])
    print("channel id", json.loads(json.dumps(event, indent=2))["resources"][0].split(":")[-1])

    _channel_id = json.loads(json.dumps(event, indent=2))["resources"][0].split(":")[-1]

    if "CREATED" in json.loads(json.dumps(event, indent=2))["detail"]["state"]:
        my_eml = aws.client('medialive')
        eml_response = my_eml.start_channel(
            ChannelId=_channel_id
        )

        print("---------------------------\n",
              "eml response start channel\n",
              json.loads(json.dumps(eml_response, indent=2)))

        if "ERROR" in eml_response:
            print("eml start channel " + _channel_id + "failed")