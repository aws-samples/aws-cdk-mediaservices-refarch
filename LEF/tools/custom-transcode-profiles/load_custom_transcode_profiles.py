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
from pprint import pprint
import urllib3
import os
import sys
from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest
from botocore.endpoint import URLLib3Session
from botocore.exceptions import ClientError, ProfileNotFound
import json
import argparse
import signal


urllib3session = URLLib3Session()
default_profile_path = "../config/encoding-profiles"

# Print a string to the console
def main():
    
    service_name = 'mediatailor'

    # Create an argument parser
    parser = argparse.ArgumentParser(description='Upload custom transcode profiles to AWS MediaTailor')
    parser.add_argument('--path', default=default_profile_path, help=f'Path to the location of the profiles (default: {default_profile_path})')
    parser.add_argument('--profile', type=str, required=False, help='AWS profile to use')
    parser.add_argument('--region', type=str, required=False, help='AWS region to use')
    parser.add_argument('encodingProfiles', nargs='+', help='List of encoding profiles to upload')
    args = parser.parse_args()

    # Get the list of profiles and the path from the parsed arguments
    custom_transcode_profile_list = args.encodingProfiles
    profile_path = args.path
    aws_profile = args.profile
    aws_region = args.region

    try:
        session = get_session(aws_profile, aws_region)
        aws_account_id = session.client('sts').get_caller_identity()['Account']
        aws_region = session.region_name

    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

    # Print summary of the aws operating environment
    print("")
    print("Operating environment:")
    print(f"\tAWS Account ID: {aws_account_id}")
    print(f"\tAWS Region: {aws_region}")
    print("\tProfiles to be uploaded:")
    for custom_transcode_profile in custom_transcode_profile_list:
        print("\t\t- %s" % custom_transcode_profile)

    # Register the signal handler for SIGINT
    # This will allow a user to use control-c to exit the prompt without receiving an error
    signal.signal(signal.SIGINT, signal_handler)

    while True:
        user_input = input("\nDo you want to proceed and upload the profiles? (y/N): ").lower()
        if user_input == 'y':
            print("Proceeding with profile upload...")
            break
        else:
            print("Exiting script.")
            sys.exit(0)

    if not check_account_enabled_for_ctp(session, aws_region, service_name):
        print("ERROR: MediaTailor custom transcode profiles are not enabled for this account")
        print("ERROR: To enable custom transcode profiles, please contact AWS support")
        sys.exit(1)

    for custom_transcode_profile in custom_transcode_profile_list:

        header_string = f"Processing '{custom_transcode_profile}' custom transcode profile:"
        header_string_length = len(header_string)

        print("")
        print(  "-" * header_string_length)
        print(header_string)
        print( "-" * header_string_length)

        # Check if custom profile already exists
        existing_ctp = custom_transcode_profile_exists( session, aws_region, service_name,custom_transcode_profile )
        new_ctp_definition_file = f'{profile_path}/{custom_transcode_profile}'
        if not new_ctp_definition_file.endswith('.json'):
            new_ctp_definition_file += '.json'

        if existing_ctp:

            # If ctp already exists compare the existing custom transcode profile with the new profile.
            # If the profiles are the same an update was not necessary and there is no reason to
            # upload the new profile.
            if existing_ctp_is_up_to_date( aws_region, service_name, existing_ctp, new_ctp_definition_file ):
                print("Custom transcode profile '%s' is up to date." % custom_transcode_profile)
                print(f"No action required to update '{custom_transcode_profile}'")
                continue
            else:
                print(f"Custom transcode profile '{custom_transcode_profile}' is different to the version contained in {new_ctp_definition_file}.")
                print("WARNING: Overriding existing profiles with a new version is not recommeneded")
                print("WARNING: If profiles are updated MediaTailor will *NOT* retranscode any ads transcoded")
                print("WARNING: with the previous profile")
                print("RECOMMENDATION: Increment a version number on profiles each time a change is made to")
                print("RECOMMENDATION: ensure all ads are retranscoded and use the same profile.")

        else:
            # Create new custom tramscode profile
            upload_custom_transcode_profile(session, aws_region, service_name, custom_transcode_profile, new_ctp_definition_file)


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
        print(f"Error: {e}")
        print("The specified AWS profile does not exist. Please check your AWS configuration.")
        sys.exit(1)
    except ClientError as e:
        if e.response['Error']['Code'] == 'ExpiredToken':
            print("Error: The AWS security token has expired. Please update your AWS credentials and try again.")
            sys.exit(1)
        else:
            print(f"Error: {e}")
            print("Unable to create an AWS session. Please check your AWS credentials and configuration.")
            sys.exit(1)
    except Exception as e:
        print(f"Error: {e}")
        print("An unexpected error occurred while creating the AWS session.")
        sys.exit(1)


def existing_ctp_is_up_to_date( aws_region, service_name, existing_ctp, new_ctp_definition_file ):

    try:
        new_ctp = load_custom_transcode_profile_from_file(new_ctp_definition_file)
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        sys.exit(1)
    
    new_ctp_string = json.dumps(new_ctp)

    if existing_ctp == new_ctp_string:
        return True

    return False

# Check if MediaTailor profile already exists before attempting to upload
# If the custom transcode profile exists the profile is returned. Otherwise None is returned
def custom_transcode_profile_exists( session, aws_region, service_name, profile_name):
    # Check if MediaTailor profile already exists before attempting to upload
    response = call_get_api( session,
                             aws_region,
                             service_name,
                             "https://api.mediatailor.%s.amazonaws.com/transcodeProfile/%s" % (aws_region, profile_name)
    )
    if response.status_code == 200:
        # Check if the request was successful
        print(f"MediaTailor custom transcode profile '{profile_name}' already exists in account")
        downloaded_profile = response.content.decode('utf-8')
        return downloaded_profile

    print(f"MediaTailor custom transcode profile '{profile_name}' does not exist in account")
    return None

def upload_custom_transcode_profile(session, aws_region, service_name, profile_name, profile_file):

    endpoint_url = "https://api.mediatailor.%s.amazonaws.com/transcodeProfile/%s" % (aws_region, profile_name)

    # Read profile data from profile_file into a byte array with exception handling
    try:
        profile_data = load_custom_transcode_profile_from_file( profile_file )
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        sys.exit(1)

    print("Profile data loaded successfully from file")
    print("Loading custom transcode profile")
    response = call_put_api(session, aws_region, service_name, endpoint_url, profile_data)
    if response.status_code == 200:
        # Check if the request was successful
        print(f"MediaTailor custom transcode profile '{profile_name}' successfully uploaded")
        downloaded_profile = response.content.decode('utf-8')
    else:
        print(f"MediaTailor custom transcode profile '{profile_name}' failed to upload")
        print(f"Response status code: {response.status_code}")
        print(f"Response content: {response.content}")


# Load custom transcode profile json from file and returns as an object
def load_custom_transcode_profile_from_file( ctp_definition_file ):

    # Raise an error if ctp_definition_file file sdoes not exist
    if not os.path.exists(ctp_definition_file):
        error_message = f"Custom transcode profile '{ctp_definition_file}' file does not exist"
        raise FileNotFoundError(error_message)

    with open(ctp_definition_file, 'rb') as f:
        profile_data = f.read()

    # Raise an error if profile_data is an empty string
    if not profile_data:
        error_message = "Specified custom transcode profile file is empty"
        raise ValueError(error_message)

    try:
        parsed_data = json.loads(profile_data)
    except json.JSONDecodeError as e:
        error_message = f"Error: Unable to parse the provided data as JSON. {e}"
        raise RuntimeError(error_message) from e
    except Exception as e:
        error_message = f"Error: An unexpected error occurred while parsing the JSON data. {e}"
        raise RuntimeError(error_message) from e

    return json.dumps(parsed_data)

def check_account_enabled_for_ctp(session, aws_region, service_name):

    endpoint_url = "https://api.mediatailor.%s.amazonaws.com/transcodeProfile/nonExistentProfile" % aws_region

    response = call_get_api(session, aws_region, service_name, endpoint_url)
    if response.status_code == 404:
        # Check if the request was successful
        return True

    print(f"Response status code: {response.status_code}")
    print(f"Response content: {response.content}")

    return False

def call_get_api(session, region_name, service_name, endpoint_url):

    # Create a request object
    request = AWSRequest(
        method='GET',
        url=f"{endpoint_url}",
        headers={'Content-Type': 'application/json'},
        data=b''
    )

    # Create a SigV4 auth object
    auth = SigV4Auth(session.get_credentials(), service_name, region_name)

    # Add authentication to the request
    auth.add_auth(request)

    try:
        # Send the request
        response = urllib3session.send(request.prepare())

    except urllib3.exceptions.HTTPError as e:
        # Handle HTTP errors
        print(f"HTTP Error: {e}")

    except Exception as e:
        # Handle other exceptions
        print(f"Error: {e}")

    # Return the response
    return response

def call_put_api(session, region_name, service_name, endpoint_url, data):

    # Create a request object
    request = AWSRequest(
        method='PUT',
        url=f"{endpoint_url}",
        headers={'Content-Type': 'application/json'},
        data=data
    )

    # Create a SigV4 auth object
    auth = SigV4Auth(session.get_credentials(), service_name, region_name)

    # Add authentication to the request
    auth.add_auth(request)

    try:
        # Send the request
        response = urllib3session.send(request.prepare())

    except urllib3.exceptions.HTTPError as e:
        # Handle HTTP errors
        print(f"HTTP Error: {e}")

    except Exception as e:
        # Handle other exceptions
        print(f"Error: {e}")

    # Return the response
    return response

def signal_handler(signal, frame):
    print("\nExiting script...")
    sys.exit(0)

if __name__ == "__main__":
    main()