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

import os
import boto3

# Create an SNS client
sns = boto3.client('sns')

def lambda_handler(event, context):
    # Get the account ID from the context object
    account_id = context.invoked_function_arn.split(":")[4]

    # Get the region from the context object
    region = os.environ.get('AWS_REGION')

    topic_arn = os.environ.get('SNS_TOPIC_ARN')
    console_link = "https://" + region + ".console.aws.amazon.com/sns/v3/home?region=" + region + "#/topic/" + topic_arn

    if not topic_arn:
        raise ValueError('SNS Topic ARN is not provided')

    try:
        # Check if the SNS topic exists
        topic_attributes = sns.get_topic_attributes(TopicArn=topic_arn)
        if not topic_attributes.get('Attributes'):
            raise ValueError('SNS topic not found')

        # Get the list of subscriptions for the topic
        subscriptions = sns.list_subscriptions_by_topic(TopicArn=topic_arn)

        # Check if there are subscriptions on the topic
        if not subscriptions.get('Subscriptions'):
            raise ValueError('No subscriptions found for the SNS topic')

        # Check if at least one subscription is not in the "PendingConfirmation" state
        confirmed_subscriptions = [
            sub for sub in subscriptions['Subscriptions']
            if sub['SubscriptionArn'] != 'PendingConfirmation'
        ]

        if not confirmed_subscriptions:
            raise ValueError('All subscriptions are in the "PendingConfirmation" state. '
                             + 'Check your email and click on link to accept subscription. '
                             + 'To check the state of the subscription in the AWS Console open "'
                             + console_link + '"' )

        print('SNS topic and subscriptions are valid')
        return {
            'statusCode': 200,
            'body': 'SNS topic and subscriptions are valid'
        }

    except Exception as e:
        print(f'Error: {e}')
        raise e