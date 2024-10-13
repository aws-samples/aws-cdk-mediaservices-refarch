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

# Name and attached policies for MediaTailor Logger role
role_name = 'MediaTailorLogger'
policiesToAttach = [
    'arn:aws:iam::aws:policy/CloudWatchFullAccess',
    'arn:aws:iam::aws:policy/CloudWatchLogsFullAccess'
]

class RoleValidationError(Exception):
    pass

class RoleCreationError(Exception):
    pass

def main():
    
    # Create an argument parser
    parser = argparse.ArgumentParser(description='Check whether MediaTailor Logger role exists and offer to create if role does not exist.')
    parser.add_argument('--profile', type=str, required=False, help='AWS profile to use for creation of user')
    parser.add_argument('--region', type=str, required=False, help='AWS region to use for creation of user')
    
    # parser.add_argument('encodingProfiles', nargs='+', help='List of encoding profiles to upload')
    args = parser.parse_args()

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


    if mediatailor_logger_role_exists( iam_client ):
        print("MediaTailor Logger role exists.")
        logger.info("Exiting script.")
        sys.exit(0)

    logger.info("MediaTailor Logger role does not exist.")

    # Request permission to create role
    while True:
        user_input = input(f"\nWould you like to proceed and create the '{role_name}' the role now? (y/N): ").lower()
        if user_input == 'y':
            logger.info("Proceeding user creation...")
            break
        else:
            logger.info("Exiting script.")
            sys.exit(0)

    # Attempt to create role
    try:
        create_media_tailor_logger_role( iam_client )
    except RoleCreationError as e:
        logger.error(f"Error creating role '{role_name}': {e}")
        sys.exit(1)
    return

def mediatailor_logger_role_exists( iam_client ):

    try:
        # Check if the MediaTailorLogger role exists
        role = iam_client.get_role(RoleName=role_name)
        logger.info(f"Role '{role_name}' already exists.")

        # Check all the policies in policiesToAttach are associated
        # with the existing role and raise an exception if any of the
        # listed policies have not been attached
        attached_policies = get_attached_role_policies( role_name, iam_client )
        attached_policy_arns = [policy['PolicyArn'] for policy in attached_policies]
        policyValidationFailures = []
        for mandatoryPolicy in policiesToAttach:

            # Check if mandatory policy is attached to role
            if mandatoryPolicy not in attached_policy_arns:
                logger.error(f"Mandatory policy '{mandatoryPolicy}' is not attached to the '{role_name}' role.")
                policyValidationFailures.append(mandatoryPolicy)            
        
        # Raise error if mandatory policies do not exist
        if policyValidationFailures:
            logger.error(f"One or more mandatory policies are not attached to the '{role_name}' role.")
            logger.error(f"The script does not handle this situation and the issue will need to be manually remediated.")
            sys.exit(1)

        return True

    except ClientError as e:
        if e.response['Error']['Code'] == 'NoSuchEntity':
            # Role doesn't exist
            return False
        else:
            logger.error(f"Error checking role existence: {e}")
            sys.exit(1)


def get_attached_role_policies( role_name, iam_client ):
    """
    Retrieves the list of all policies attached to the specified IAM role.

    Args:
        role_name (str): The name of the IAM role.

    Returns:
        list: A list of attached policy dictionaries.

    Raises:
        ClientError: If there's an error retrieving the attached policies.
    """
    paginator = iam_client.get_paginator('list_attached_role_policies')
    attached_policies = []

    try:
        for response in paginator.paginate(RoleName=role_name):
            attached_policies.extend(response['AttachedPolicies'])
    except ClientError as e:
        if e.response['Error']['Code'] == 'NoSuchEntity':
            print(f"Role '{role_name}' does not exist.")
        else:
            print(f"Error listing attached policies for role '{role_name}': {e}")
            raise

    return attached_policies

def create_media_tailor_logger_role( iam_client ):
    logger.info(f"Creating role '{role_name}'...")
    
    # Define the trust policy for the MediaTailor service
    trust_policy = {
        'Version': '2012-10-17',
        'Statement': [
            {
                'Effect': 'Allow',
                'Principal': {
                    'Service': 'mediatailor.amazonaws.com'
                },
                'Action': 'sts:AssumeRole',
                'Condition': {
                    'StringEquals': {
                        'sts:ExternalId': 'Midas'
                    }
                }
            }
        ]
    }
    
    # Create the role
    try:
        response = iam_client.create_role(
            RoleName=role_name,
            AssumeRolePolicyDocument=json.dumps(trust_policy),
            Description='Role for MediaTailor logging'
        )
        role_arn = response['Role']['Arn']
    except ClientError as e:
        raise RoleValidationError(f"Error creating role: {e}")


    # Attach policies to role
    for policy in policiesToAttach:
        try:
            iam_client.attach_role_policy(
                RoleName=role_name,
                PolicyArn=policy
            )
        except ClientError as e:
            # If the policy attachment fails, delete the role
            iam_client.delete_role(RoleName=role_name)
            raise RoleValidationError(f"Error attaching policy to role: {e}")
    
    logger.info(f"Role '{role_name}' created successfully with ARN: {role_arn}")


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