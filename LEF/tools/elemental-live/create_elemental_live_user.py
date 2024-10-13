#!/usr/bin/env python

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

import boto3
import os
import sys
from botocore.exceptions import ClientError, ProfileNotFound
import json
import argparse
import signal
from pprint import pprint
import logging

# Create a logger
logger = logging.getLogger(__name__)

# Set the logger level to INFO
logger.setLevel(logging.INFO)

# Create a stream handler and add it to the logger
stream_handler = logging.StreamHandler()
logger.addHandler(stream_handler)

def main():

    # Create an argument parser
    parser = argparse.ArgumentParser(description='Create Elemental Live IAM user and return credentials')
    parser.add_argument('--username', type=str, required=True, help=f'Username for user to be created')
    parser.add_argument('--profile', type=str, required=False, help='AWS profile to use for creation of user')
    parser.add_argument('--region', type=str, required=False, help='AWS region to use for creation of user')
    
    # parser.add_argument('encodingProfiles', nargs='+', help='List of encoding profiles to upload')
    args = parser.parse_args()

    iam_username = args.username
    aws_profile = args.profile
    aws_region = args.region

    try:
        session = get_session(aws_profile, aws_region)
        aws_account_id = session.client('sts').get_caller_identity()['Account']
        aws_region = session.region_name

          # Get IAM client
        iam_client = session.client('iam')
    except Exception as e:
        logger.error(f"Error: {e}")
        sys.exit(1)

    # Print summary of the aws operating environment
    logger.info("")
    logger.info("Operating environment:")
    logger.info(f"\tAWS Account ID: {aws_account_id}")
    logger.info(f"\tAWS Region: {aws_region}")
    logger.info(f"\nProcess will perform the following steps:")
    logger.info(f"\t- Create IAM User")
    logger.info(f"\t- Attach inline policy to IAM user allowing user to push content to MediaPackage V2 channels in account.")
    logger.info(f"\t- Create user Access Key pair for authentication")


    # Register the signal handler for SIGINT
    # This will allow a user to use control-c to exit the prompt without receiving an error
    signal.signal(signal.SIGINT, signal_handler)

    while True:
        user_input = input("\nDo you want to proceed and create IAM user in this account? (y/N): ").lower()
        if user_input == 'y':
            logger.info("Proceeding user creation...")
            break
        else:
            logger.info("Exiting script.")
            sys.exit(0)

    # Check if user exists and raise exception if it does
    if user_exists(iam_username, iam_client):
        logger.error(f"Error: IAM User '{iam_username}' already exists.")
        sys.exit(1)

    # Create IAM user
    logger.info(f"Creating IAM User '{iam_username}':\t")
    userDetails = create_iam_user(iam_username, iam_client)
    if not userDetails:
        logger.error(f"Error: Failed to create user.")
        sys.exit(1)

    # Attached inline policy to IAM User
    # Policy allows user to 'mediapackagev2:PutObject' to all channels in the region
    logger.info("Attaching inline policy to IAM User:\t")
    if not attach_mediapackage_inline_policy_to_user(iam_username, iam_client, aws_account_id, aws_region):
        logger.error(f"Error: Failed to attach inline policy to '{iam_username}'.")
        sys.exit(1)

    # Create Access Key for user
    logger.info("Creating Access Key for IAM User:\t")
    access_key = create_access_key( iam_username, iam_client )

    print("\nCreated IAM User Details:")
    print("\tUser ARN:\t\t", userDetails['User']['Arn'])
    print("\tAccessKeyId:\t\t", access_key['AccessKeyId'])
    print("\tSecretAccessKey:\t", access_key['SecretAccessKey'])



def user_exists(username, iam_client):
    """
    Checks if an IAM user exists.

    Args:
        username (str): The name of the IAM user to check.
        iam_client (boto3.client): A Boto3 IAM client instance.

    Returns:
        bool: True if the user exists, False otherwise.
    """
    try:
        iam_client.get_user(UserName=username)
        return True
    except iam_client.exceptions.NoSuchEntityException:
        return False
    except Exception as e:
        logger.error(f"\t\tAn error occurred: {e}")
        return False

def create_iam_user(username, iam_client):
    """
    Creates an IAM user.

    Args:
        username (str): The name of the IAM user to create.
        iam_client (boto3.client): A Boto3 IAM client instance.

    Returns:
        dict: The response from the CreateUser operation.
    """
    try:
        response = iam_client.create_user(UserName=username)
        logger.info(f"\t\tUser '{username}' created successfully.")
        return response
    except iam_client.exceptions.EntityAlreadyExistsException:
        logger.error(f"\t\tUser '{username}' already exists.")
        return None
    except Exception as e:
        logger.error(f"\t\tAn error occurred: {e}")
        return None

def attach_mediapackage_inline_policy_to_user(username, iam_client, aws_account_id, aws_region):
    """
    Attaches an inline policy to an IAM user, allowing the mediapackagev2:PutObject action
    on all MediaPackage channels in the specified AWS account and region.

    Args:
        username (str): The name of the IAM user to attach the policy to.
        iam_client (boto3.client): A Boto3 IAM client instance.
        aws_account_id (str): The AWS account ID.
        aws_region (str): The AWS region.

    Returns:
        bool: True if the policy was attached successfully, False otherwise.
    """
    policy_name = "MediaPackagePutObjectPolicy"
    policy_document = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Action": "mediapackagev2:PutObject",
                "Resource": f"arn:aws:mediapackagev2:{aws_region}:{aws_account_id}:channelGroup/*",
            }
        ]
    }

    try:
        # Attach the inline policy to the user
        iam_client.put_user_policy(
            UserName=username,
            PolicyName=policy_name,
            PolicyDocument=json.dumps(policy_document),
        )
        logger.info(f"\t\tInline policy '{policy_name}' attached to user '{username}' successfully.")
        return True
    except iam_client.exceptions.EntityAlreadyExistsException:
        logger.error(f"\t\tPolicy '{policy_name}' already exists for user '{username}'.")
    except Exception as e:
        logger.error(f"\t\tAn error occurred: {e}")
    return False

def create_access_key(username, iam_client):
    """
    Creates an access key for the specified IAM user.

    Args:
        username (str): The name of the IAM user.
        iam_client (boto3.client): A Boto3 IAM client instance.

    Returns:
        dict: The created access key pair.
    """
    try:
        key_pair = iam_client.create_access_key(UserName=username)
        logger.info(
            "\t\tCreated access key pair for %s. Key ID is %s.",
            username,
            key_pair["AccessKey"]["AccessKeyId"],
        )
        return key_pair["AccessKey"]
    except iam_client.exceptions.NoSuchEntityException:
        logger.error("\t\tIAM User '%s' does not exist.", username)
    except iam_client.exceptions.LimitExceededException:
        logger.error(
            "\t\tUnable to create access key for '%s'. The maximum number of access keys for this user has been reached.",
            username,
        )
    except Exception as e:
        logger.error("\t\tAn error occurred: %s", e)

def get_session(aws_profile, aws_region):
    try:
        if aws_profile:
            session = boto3.Session(profile_name=aws_profile, region_name=aws_region)
        else:
            # Check for environment variables
            access_key = os.environ.get('AWS_ACCESS_KEY_ID')
            secret_key = os.environ.get('AWS_SECRET_ACCESS_KEY')
            region_name = aws_region if aws_region else os.environ.get('AWS_REGION')
            if region_name is None:
                raise ValueError("AWS region name must be specified in either the '--region' parameter or 'AWS_REGION' environment variable")

            if access_key and secret_key and region_name:
                session = boto3.Session(
                    aws_access_key_id=access_key,
                    aws_secret_access_key=secret_key,
                    region_name=region_name
                )
            else:
                # Fall back to default AWS profile
                session = boto3.Session(region_name=region_name)

        if session.region_name is None:
            raise ValueError("AWS region name must be specified with'--region' parameter")

        # Verify the session by making a simple STS call
        session.client('sts').get_caller_identity()
        return session
    except ProfileNotFound as e:
        logger.error(f"Error: {e}")
        logger.error("The specified AWS profile does not exist. Please check your AWS configuration.")
        sys.exit(1)
    except ClientError as e:
        if e.response['Error']['Code'] == 'ExpiredToken':
            logger.error("Error: The AWS security token has expired. Please update your AWS credentials and try again.")
            sys.exit(1)
        else:
            logger.error(f"Error: {e}")
            logger.error("Unable to create an AWS session. Please check your AWS credentials and configuration.")
            sys.exit(1)
    except Exception as e:
        logger.error(f"Error: {e}")
        logger.error("An unexpected error occurred while creating the AWS session.")
        sys.exit(1)

def signal_handler(signal, frame):
    logger.info("\nExiting script...")
    sys.exit(0)

if __name__ == "__main__":
    main()