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
import logging
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

iam_client = boto3.client('iam')
role_name = 'MediaTailorLogger'

policiesToAttach = [
    'arn:aws:iam::aws:policy/CloudWatchFullAccess',
    'arn:aws:iam::aws:policy/CloudWatchLogsFullAccess'
]

class RoleCreationError(Exception):
    pass

def lambda_handler(event, context):
    try:
        # Check if the MediaTailorLogger role exists
        role = iam_client.get_role(RoleName=role_name)
        logger.info(f"Role '{role_name}' already exists.")

        # Check all the policies in policiesToAttach are associated
        # with the existing role and raise an exception if any of the
        # listed policies have not been attached
        attached_policies = get_attached_role_policies( role_name, iam_client )
        attached_policy_arns = [policy['PolicyArn'] for policy in attached_policies]
        for mandatoryPolicy in policiesToAttach:

            # Check if mandatory policy is attached to role
            if mandatoryPolicy not in attached_policy_arns:
                raise RoleCreationError(f"Policy '{mandatoryPolicy}' is not attached to role '{role_name}'")

        return {
            'statusCode': 200,
            'body': f"Role '{role_name}' already exists."
        }
    except ClientError as e:
        if e.response['Error']['Code'] == 'NoSuchEntity':
            # Role doesn't exist, create it
            raise RoleCreationError(f"Role '{role_name}' does not exist. Review 'Before Getting Started' section of project README.md")
        else:
            logger.error(f"Unexpected error: {e}")
            raise RoleCreationError(f"Unexpected error: {e}")

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