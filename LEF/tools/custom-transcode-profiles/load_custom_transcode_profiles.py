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

from typing import Optional, Any, Dict, List
import time
import boto3
from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest
from botocore.endpoint import URLLib3Session
from botocore.exceptions import ClientError, ProfileNotFound
import urllib3
import os
import sys
import json
import argparse
import signal
from dataclasses import dataclass
import logging
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Reduce noise from other loggers
logging.getLogger('botocore').setLevel(logging.WARNING)
logging.getLogger('boto3').setLevel(logging.WARNING)
logging.getLogger('urllib3').setLevel(logging.WARNING)

# Constants
# amazonq-ignore-next-line
DEFAULT_PROFILE_PATH = "../config/encoding-profiles"
MEDIATAILOR_API_BASE = "api.mediatailor.{region}.amazonaws.com"
SERVICE_NAME = "mediatailor"

@dataclass
class AWSConfig:
    """Class to hold AWS configuration settings."""
    session: boto3.Session
    region: str
    account_id: str

    @classmethod
    def create_from_args(cls, profile: Optional[str], region: Optional[str]) -> 'AWSConfig':
        """
        Create an AWSConfig instance from provided arguments.
        
        Args:
            profile: Optional AWS profile name
            region: Optional AWS region name
            
        Returns:
            AWSConfig instance
        
        Raises:
            ValueError: If region is not provided and cannot be determined
            ClientError: If AWS credentials are invalid
        """
        try:
            session = cls._create_session(profile, region)
            account_id = session.client('sts').get_caller_identity()['Account']
            return cls(session=session, region=session.region_name, account_id=account_id)
        except ValueError as e:
            raise ValueError(f"Failed to create AWS configuration: {str(e)}") from e
        except ClientError as e:
            raise ClientError(f"Failed to create AWS configuration: {str(e)}", e.response['Error'])
        except Exception as e:
            # amazonq-ignore-next-line
            raise Exception(f"Unexpected error while creating AWS configuration: {str(e)}") from e

    @staticmethod
    # amazonq-ignore-next-line
    def _create_session(profile: Optional[str], region: Optional[str]) -> boto3.Session:
        """Create and validate AWS session."""
        try:
            if profile:
                session = boto3.Session(profile_name=profile, region_name=region)
            else:
                # Try to get region from command line, environment, or default config
                region_name = region or os.environ.get('AWS_REGION')
                if not region_name:
                    # Try to get default region from boto3
                    default_session = boto3.Session()
                    region_name = default_session.region_name
                
                if not region_name:
                    raise ValueError("AWS region must be specified via --region, AWS_REGION environment variable, or AWS default region configuration")
                
                session = boto3.Session(region_name=region_name)
            
            if not session.region_name:
                raise ValueError("AWS region name must be specified")
            
            return session
            
        except ProfileNotFound as e:
            logger.error("The specified AWS profile does not exist")
            raise
        except ClientError as e:
            if e.response['Error']['Code'] == 'ExpiredToken':
                logger.error("AWS security token has expired")
            raise

class MediaTailorAPI:
    """Handler for MediaTailor API operations."""
    
    def __init__(self, config: AWSConfig):
        self.config = config
        self.http_session = URLLib3Session()

    def _make_request(self, method: str, endpoint: str, data: Optional[str] = None) -> urllib3.HTTPResponse:
        """Make authenticated request to MediaTailor API."""
        mediaTailorEndpointHostname=f"{MEDIATAILOR_API_BASE.format(region=self.config.region)}"
        url = f"https://{mediaTailorEndpointHostname}/{endpoint}"
        logger.debug(f"Making {method} request to {url}")
        logger.debug(f"Request data: {data if data else 'empty'}")
        
        headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Host': f"{mediaTailorEndpointHostname}"
        }
        request = AWSRequest(
            method=method,
            url=url,
            headers=headers,
            data=data.encode('utf-8') if data else b''
        )
        
        auth = SigV4Auth(self.config.session.get_credentials(), SERVICE_NAME, self.config.region)
        auth.add_auth(request)
        
        try:
            prepared_request = request.prepare()
            response = self.http_session.send(prepared_request)
            if logger.isEnabledFor(logging.DEBUG):
                logger.debug(f"Request headers: {dict(prepared_request.headers)}")
                logger.debug(f"Response status: {response.status_code}")
                logger.debug(f"Response headers: {dict(response.headers)}")
                logger.debug(f"Response content: {response.content.decode('utf-8') if response.content else 'empty'}")
            return response
        except urllib3.exceptions.RequestError as e:
            logger.error(f"Network error during API request: {str(e)}", exc_info=True)
            raise
        except urllib3.exceptions.TimeoutError as e:
            logger.error(f"Timeout error during API request: {str(e)}", exc_info=True)
            raise
        except Exception as e:
            logger.error(f"Unexpected error during API request: {str(e)}", exc_info=True)
            raise

    def check_profile_exists(self, profile_name: str) -> Optional[str]:
        """
        Check if a transcode profile exists.
        
        Returns:
            The profile content if it exists, None otherwise
        """
        try:
            response = self._make_request('GET', f"transcodeProfile/{profile_name}")
            if not response.content:
                logger.warning("Empty response received when checking profile existence")
                return None
            if logger.isEnabledFor(logging.DEBUG):
                logger.debug(f"Check profile exists response: status={response.status_code}, content={response.content.decode('utf-8')}")
        except urllib3.exceptions.RequestError as e:
            logger.error(f"Network error when checking if profile exists: {e}", exc_info=True)
            return None
        except urllib3.exceptions.TimeoutError as e:
            logger.error(f"Timeout error when checking if profile exists: {e}", exc_info=True)
            return None
        # amazonq-ignore-next-line
        except Exception as e:
            logger.error(f"Unexpected error when checking if profile exists: {e}", exc_info=True)
            raise  # Let unexpected exceptions propagate
        
        if response.status_code == 200:
            logger.info(f"Profile '{profile_name}' exists")
            try:
                content = response.content.decode('utf-8')
                # Verify the content is valid JSON
                json.loads(content)
                return content
            except json.JSONDecodeError as e:
                logger.error(f"Invalid JSON response: {e}")
                return None
        elif response.status_code in (404, 403):
            # 404 means profile doesn't exist, 403 can mean profile doesn't exist with Sigv4
            logger.info(f"Profile '{profile_name}' does not exist")
            return None
        else:
            logger.error(f"Unexpected status {response.status_code} checking profile '{profile_name}': {response.content.decode('utf-8')}")
            return None

    def check_account_enabled(self) -> bool:
        """Check if account is enabled for custom transcode profiles."""
        try:
            response = self._make_request('GET', "transcodeProfile/nonExistentProfile")
            return response.status_code == 404
        except urllib3.exceptions.RequestError as e:
            logger.error(f"Network error when checking account enablement: {e}")
            return False
        except urllib3.exceptions.TimeoutError as e:
            logger.error(f"Timeout error when checking account enablement: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error when checking account enablement: {e}")
            return False

    def upload_profile(self, profile_name: str, profile_data: Dict[str, Any]) -> bool:
        """
        Upload a custom transcode profile after performing necessary checks.
        
        Returns:
            True if successful, False otherwise
        """
        if not self._check_and_confirm_profile_upload(profile_name, profile_data):
            return False

        return self._perform_profile_upload(profile_name, profile_data)

    def _check_and_confirm_profile_upload(self, profile_name: str, profile_data: Dict[str, Any]) -> bool:
        logger.info(f"Checking if profile '{profile_name}' exists...")
        existing_profile = self.check_profile_exists(profile_name)
        logger.info(f"Profile existence check result: {existing_profile is not None}")
        
        if existing_profile:
            return self._handle_existing_profile(profile_name, profile_data, existing_profile)
        return True

    def _handle_existing_profile(self, profile_name: str, profile_data: Dict[str, Any], existing_profile: str) -> bool:
        existing_profile_dict = json.loads(existing_profile)
        logger.debug(f"Comparing profiles:\nExisting: {json.dumps(existing_profile_dict, sort_keys=True)}\nNew: {json.dumps(profile_data, sort_keys=True)}")
        if json.dumps(profile_data, sort_keys=True) == json.dumps(existing_profile_dict, sort_keys=True):
            logger.info(f"Profile '{profile_name}' is up to date")
            logger.info(f"Profile has not been loaded as it is the same as the version currently available in the account.")
            return False
        
        logger.warning(
            f"Profile '{profile_name}' exists with different content.\n"
            "WARNING: Updating existing profiles is not recommended as it won't retranscode existing ads.\n"
            "RECOMMENDATION: Use versioned profile names for changes."
        )
        
        return self._confirm_overwrite(profile_name)

    def _confirm_overwrite(self, profile_name: str) -> bool:
        response = input(f"Profile '{profile_name}' already exists. Do you want to overwrite it? (y/N): ")
        if response.lower() != 'y':
            logger.info("Upload cancelled")
            return False
        return True

    def _perform_profile_upload(self, profile_name: str, profile_data: Dict[str, Any]) -> bool:
        response = self._make_request(
            'PUT',
            f"transcodeProfile/{profile_name}",
            json.dumps(profile_data)
        )
        
        if response.status_code == 200:
            logger.info(f"Successfully uploaded profile '{profile_name}'")
            time.sleep(2)
            return True
        elif response.status_code == 409:
            logger.error(f"Profile '{profile_name}' already exists")
            return False
        
        logger.error(f"Failed to upload profile '{profile_name}': {response.content.decode('utf-8')}")
        return False

def parse_args() -> argparse.Namespace:
    """Parse and validate command line arguments."""
    parser = argparse.ArgumentParser(
        description='Upload custom transcode profiles to AWS MediaTailor'
    )
    parser.add_argument(
        '--profile-path',
        required=True,
        help='Path to the JSON profile file to upload',
        type=str
    )
    parser.add_argument(
        '--profile-name',
        help='Name to use when loading the profile into AWS (default: derived from file path)',
        type=str
    )
    parser.add_argument(
        '--profile',
        help='AWS profile name',
        type=str
    )
    parser.add_argument(
        '--region',
        help='AWS region'
    )
    return parser.parse_args()

def main() -> None:
    """Main entry point for the script."""
    args = parse_args()
    
    try:
        # Validate profile path
        if not args.profile_path.endswith('.json'):
            logger.error(f"Profile path must point to a JSON file")
            sys.exit(1)

        # Determine profile name
        profile_name = args.profile_name
        if not profile_name:
            # Extract directory and filename
            path_parts = args.profile_path.split('/')
            directory = path_parts[-2] if len(path_parts) > 1 else ''
            filename = path_parts[-1]
            # Remove .json extension and construct name
            filename_no_ext = filename[:-5] if filename.endswith('.json') else filename
            profile_name = f"{directory}-{filename_no_ext}" if directory else filename_no_ext

        config = AWSConfig.create_from_args(args.profile, args.region)
        
        # Log execution environment
        logger.info("Operating environment:")
        logger.info(f"AWS Account ID: {config.account_id}")
        logger.info(f"AWS Region: {config.region}")
        logger.info(f"Profile to upload: {profile_name}")
        logger.info(f"Profile path: {args.profile_path}")
        
        # Confirm operation
        if input("Proceed with profile upload? (y/N): ").lower() != 'y':
            logger.info("Operation cancelled")
            return
            
        # Check account enablement
        api = MediaTailorAPI(config)
        if not api.check_account_enabled():
            logger.error(
                "MediaTailor custom transcode profiles are not enabled for this account.\n"
                "Please contact AWS support to enable this feature."
            )
            sys.exit(1)
            
        # Process profile
        try:
            with open(args.profile_path, 'r') as f:
                profile_data = json.load(f)
        except FileNotFoundError:
            logger.error(f"Profile file not found: {args.profile_path}")
            sys.exit(1)
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON in profile file: {args.profile_path}")
            sys.exit(1)
            
        # Upload profile
        if not api.upload_profile(profile_name, profile_data):
            logger.error(f"Failed to upload profile {profile_name}")
            sys.exit(1)
            
        sys.exit(0)
        
    except Exception as e:
        logger.error(f"Script execution failed: {str(e)}")
        sys.exit(1)

def signal_handler(sig, frame):
    """Handle interrupt signal."""
    logger.info("\nOperation cancelled by user")
    sys.exit(0)

if __name__ == "__main__":
    signal.signal(signal.SIGINT, signal_handler)
    main()