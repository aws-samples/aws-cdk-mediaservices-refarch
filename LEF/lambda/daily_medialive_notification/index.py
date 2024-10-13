#
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
#

import boto3
import os
import json

# Initialize AWS clients outside the handler for better performance
medialive_client = boto3.client('medialive')
sns_client = boto3.client('sns')

def get_running_channels():
    """
    Query MediaLive to identify all running channels with a 'LiveEventFrameworkVersion' tag.

    Returns:
    list: A list of dictionaries containing channel information.
    """
    channels = []
    paginator = medialive_client.get_paginator('list_channels')
    
    try:
        for page in paginator.paginate():
            for channel in page['Channels']:
                if channel['State'] == 'RUNNING':
                    channel_id = channel['Id']
                    channel_detail = medialive_client.describe_channel(ChannelId=channel_id)
                    
                    if 'Tags' in channel_detail and 'LiveEventFrameworkVersion' in channel_detail['Tags']:
                        channels.append({
                            'ChannelId': channel_id,
                            'Name': channel['Name']
                        })
        
        print(f"Found {len(channels)} running channels with 'LiveEventFrameworkVersion' tag.")
        return channels
    except Exception as e:
        print(f"Error querying MediaLive channels: {str(e)}")
        raise

def send_sns_notification(channels):
    """
    Send a summary of running channels to the specified SNS topic.

    Args:
    channels (list): A list of dictionaries containing channel information.
    """
    sns_topic_arn = os.environ.get('SNS_TOPIC_ARN')
    if not sns_topic_arn:
        raise ValueError("SNS_TOPIC_ARN environment variable is not set.")

    message = "Summary of running MediaLive channels:\n\n"
    for channel in channels:
        message += f"Channel ID: {channel['ChannelId']}\n"
        message += f"Name: {channel['Name']}\n\n"

    message += "\nWARNING: Running MediaLive channels incur AWS charges. "
    message += "Over a long period of time, these charges can add up significantly. "
    message += "Please review your channel usage regularly to optimize costs."

    try:
        response = sns_client.publish(
            TopicArn=sns_topic_arn,
            Message=message,
            Subject="MediaLive Running Channels Summary and Cost Warning"
        )
        print(f"SNS notification sent successfully. Message ID: {response['MessageId']}")
    except Exception as e:
        print(f"Error sending SNS notification: {str(e)}")
        raise

def lambda_handler(event, context):
    """
    AWS Lambda function handler to query running MediaLive channels and send a summary via SNS.

    Args:
    event (dict): The event dict containing input parameters.
    context (object): The context object providing runtime information.

    Returns:
    dict: A dictionary containing the execution status and any error messages.
    """
    try:
        print("Starting Lambda function execution.")
        running_channels = get_running_channels()
        
        if running_channels:
            send_sns_notification(running_channels)
            return {
                'statusCode': 200,
                'body': json.dumps('Successfully sent running channels summary with cost warning.')
            }
        else:
            print("No running channels found with 'LiveEventFrameworkVersion' tag.")
            return {
                'statusCode': 200,
                'body': json.dumps('No running channels found with LiveEventFrameworkVersion tag.')
            }
    except Exception as e:
        error_message = f"Error in Lambda function: {str(e)}"
        print(error_message)
        return {
            'statusCode': 500,
            'body': json.dumps(error_message)
        }

# Print the entire function for debugging purposes
print("Lambda function code:")
print(open(__file__).read())
