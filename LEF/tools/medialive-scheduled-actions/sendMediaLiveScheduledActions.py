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
import sys
import json
import signal
from pprint import pprint
from datetime import datetime, timedelta, timezone
from botocore.exceptions import BotoCoreError, ClientError
from collections import OrderedDict

# Global variable to store the last used layer
last_used_layer = 0

# ANSI color codes for terminal output
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

def print_header(message):
    print(f"{Colors.HEADER}{Colors.BOLD}=== {message} ==={Colors.ENDC}")

def print_info(message):
    print(f"{Colors.BLUE}INFO: {message}{Colors.ENDC}")

def print_success(message):
    print(f"{Colors.GREEN}SUCCESS: {message}{Colors.ENDC}")

def print_warning(message):
    print(f"{Colors.YELLOW}WARNING: {message}{Colors.ENDC}")

def print_error(message):
    print(f"{Colors.RED}ERROR: {message}{Colors.ENDC}")

def print_json(title, data):
    print(f"{Colors.CYAN}{title}:{Colors.ENDC}")
    formatted_json = json.dumps(data, indent=2)
    print(formatted_json)

def get_aws_region():
    """Get the AWS region from boto3 configuration or prompt user if not configured"""
    session = boto3.session.Session()
    default_region = session.region_name
    
    if default_region:
        return default_region
    
    # Prompt user if no default region is configured
    default_region = 'us-east-1'
    region = input(f"Enter AWS region (default: {default_region}): ").strip()
    if not region:
        region = default_region
    return region

def list_medialive_channels(client):
    """List all MediaLive channels in the account"""
    try:
        response = client.list_channels()
        return response.get('Channels', [])
    except Exception as e:
        print_error(f"Failed to list MediaLive channels: {str(e)}")
        return []

def get_channel_feature_activations(client, channel_id):
    """Get feature activations for a specific channel"""
    try:
        response = client.describe_channel(ChannelId=channel_id)
        # Feature activations are under EncoderSettings
        encoder_settings = response.get('EncoderSettings', {})
        feature_activations = encoder_settings.get('FeatureActivations', {})
        
        # Check if blackoutSlate is enabled
        blackout_slate = encoder_settings.get('BlackoutSlate', {})
        blackout_slate_enabled = blackout_slate.get('State', 'DISABLED') == 'ENABLED'
        
        return {
            'InputPrepareScheduleActions': feature_activations.get('InputPrepareScheduleActions', 'DISABLED'),
            'OutputStaticImageOverlayScheduleActions': feature_activations.get('OutputStaticImageOverlayScheduleActions', 'DISABLED'),
            'BlackoutSlateEnabled': blackout_slate_enabled
        }
    except Exception as e:
        print_error(f"Failed to get channel feature activations: {str(e)}")
        return {
            'InputPrepareScheduleActions': 'UNKNOWN',
            'OutputStaticImageOverlayScheduleActions': 'UNKNOWN',
            'BlackoutSlateEnabled': False
        }

def display_channels(channels):
    """Display available MediaLive channels with their states"""
    if not channels:
        print_warning("No MediaLive channels found in this account/region.")
        return False
    
    print_header("Available MediaLive Channels")
    print(f"{'Index':<6} {'Channel ID':<15} {'Name':<30} {'State':<15}")
    print("-" * 70)
    
    for idx, channel in enumerate(channels, 1):
        channel_id = channel.get('Id', 'N/A')
        name = channel.get('Name', 'Unnamed')
        state = channel.get('State', 'UNKNOWN')
        
        # Color-code the state
        if state == 'RUNNING':
            state_display = f"{Colors.GREEN}{state}{Colors.ENDC}"
        elif state == 'IDLE':
            state_display = f"{Colors.BLUE}{state}{Colors.ENDC}"
        elif state == 'CREATING' or state == 'STARTING':
            state_display = f"{Colors.YELLOW}{state}{Colors.ENDC}"
        elif state == 'DELETED' or state == 'DELETING' or state == 'FAILED':
            state_display = f"{Colors.RED}{state}{Colors.ENDC}"
        else:
            state_display = state
            
        print(f"{idx:<6} {channel_id:<15} {name:<30} {state_display:<15}")
    
    return True

def select_channel(channels):
    """Prompt user to select a channel"""
    if not channels:
        return None
        
    while True:
        try:
            choice = input("\nEnter the index of the channel you want to work with: ").strip()
            idx = int(choice) - 1
            if 0 <= idx < len(channels):
                return channels[idx]
            else:
                print_error(f"Invalid selection. Please enter a number between 1 and {len(channels)}.")
        except ValueError:
            print_error("Please enter a valid number.")

def display_action_menu(client, channel_id):
    """Display the menu of available scheduled actions"""
    # Get feature activations for the channel
    feature_activations = get_channel_feature_activations(client, channel_id)
    input_prepare_status = feature_activations['InputPrepareScheduleActions']
    static_image_overlay_status = feature_activations['OutputStaticImageOverlayScheduleActions']
    
    print_header("Available Scheduled Actions")
    print("1. Input Switch")
    
    # Display Input Prepare option with status
    if input_prepare_status == 'ENABLED':
        print("2. Input Prepare")
    else:
        print(f"2. Input Prepare {Colors.YELLOW}[NOT AVAILABLE - Feature {input_prepare_status} on MediaLive Channel]{Colors.ENDC}")
    
    print("3. Insert Time Signal Provider Advertisement")
    
    # Display Network Start option with blackout slate status
    if feature_activations['BlackoutSlateEnabled']:
        print("4. Insert Network Start (Blackout Slate Enabled)")
    else:
        print("4. Insert Network Start (Blackout Slate Disabled)")
    
    # Display Network End option with blackout slate status
    if feature_activations['BlackoutSlateEnabled']:
        print("5. Insert Network End (Blackout Slate Enabled)")
    else:
        print("5. Insert Network End (Blackout Slate Disabled)")
    
    # Display Static Image Overlay option with status
    if static_image_overlay_status == 'ENABLED':
        print("6. Static Image Overlay (Activate)")
        print("7. Static Image Overlay (Deactivate)")
    else:
        print(f"6. Static Image Overlay (Activate) {Colors.YELLOW}[NOT AVAILABLE - Feature {static_image_overlay_status} on MediaLive Channel]{Colors.ENDC}")
        print(f"7. Static Image Overlay (Deactivate) {Colors.YELLOW}[NOT AVAILABLE - Feature {static_image_overlay_status} on MediaLive Channel]{Colors.ENDC}")
    
    print("8. Exit")
    
    while True:
        try:
            choice = input("\nSelect an action (1-9): ").strip()
            action = int(choice)
            if 1 <= action <= 9:
                # If user selects a disabled feature, show warning
                if (action == 2 and input_prepare_status != 'ENABLED'):
                    print_warning(f"Input Prepare feature is {input_prepare_status} for this channel.")
                    print_warning("This feature must be enabled when creating the channel.")
                    continue
                elif ((action == 6 or action == 7) and static_image_overlay_status != 'ENABLED'):
                    print_warning(f"Static Image Overlay feature is {static_image_overlay_status} for this channel.")
                    print_warning("This feature must be enabled when creating the channel.")
                    continue
                return action
            else:
                print_error("Invalid selection. Please enter a number between 1 and 9.")
        except ValueError:
            print_error("Please enter a valid number.")

def list_channel_inputs(client, channel_id):
    """List all inputs attached to a channel"""
    try:
        response = client.describe_channel(ChannelId=channel_id)
        input_attachments = response.get('InputAttachments', [])
        
        if not input_attachments:
            print_warning("No inputs are attached to this channel.")
            return []
        
        # Get the active input attachment name if available
        active_input_name = None
        if response.get('State') == 'RUNNING':
            # For a running channel, try to get the active input
            try:
                # The active input is typically in the channel's status
                status_response = client.describe_channel(ChannelId=channel_id)
                pipelines = status_response.get('PipelineDetails', [])
                
                # Check if any pipeline has active input information
                for pipeline in pipelines:
                    active_input_attachment = pipeline.get('ActiveInputAttachmentName')
                    if active_input_attachment:
                        active_input_name = active_input_attachment
                        break
            except Exception as e:
                print_warning(f"Could not determine active input: {str(e)}")
            
        inputs = []
        for attachment in input_attachments:
            input_id = attachment.get('InputId')
            input_name = attachment.get('InputAttachmentName', 'Unnamed')
            is_active = (input_name == active_input_name)
            inputs.append({
                'InputId': input_id,
                'InputAttachmentName': input_name,
                'InputSettings': attachment.get('InputSettings', {}),
                'IsActive': is_active
            })
        
        return inputs
    except Exception as e:
        print_error(f"Failed to list channel inputs: {str(e)}")
        return []

def display_inputs(inputs):
    """Display available inputs for a channel"""
    if not inputs:
        return False
    
    print_header("Available Inputs")
    print(f"{'Index':<6} {'Input ID':<15} {'Input Name':<30} {'Status':<10}")
    print("-" * 65)
    
    for idx, input_info in enumerate(inputs, 1):
        input_id = input_info.get('InputId', 'N/A')
        name = input_info.get('InputAttachmentName', 'Unnamed')
        is_active = input_info.get('IsActive', False)
        
        # Mark the active input with a colored indicator
        status = f"{Colors.GREEN}ACTIVE{Colors.ENDC}" if is_active else ""
        
        print(f"{idx:<6} {input_id:<15} {name:<30} {status:<10}")
    
    return True

def select_input(inputs):
    """Prompt user to select an input"""
    if not inputs:
        return None
        
    while True:
        try:
            choice = input("\nEnter the index of the input you want to use: ").strip()
            idx = int(choice) - 1
            if 0 <= idx < len(inputs):
                return inputs[idx]
            else:
                print_error(f"Invalid selection. Please enter a number between 1 and {len(inputs)}.")
        except ValueError:
            print_error("Please enter a valid number.")

def get_schedule_time():
    """Get the schedule time for the action"""
    while True:
        try:
            print("\nWhen should this action be scheduled?")
            print("1. Immediately")
            print("2. At a specific time")
            choice = input("Enter your choice (1-2): ").strip()
            
            if choice == '1':
                return None  # Immediate execution
            elif choice == '2':
                # Get seconds from now
                seconds = int(input("Enter seconds from now to schedule the action: ").strip())
                if seconds < 0:
                    print_error("Time cannot be in the past.")
                    continue
                return seconds
            else:
                print_error("Invalid choice. Please enter 1 or 2.")
        except ValueError:
            print_error("Please enter a valid number.")

# Input clipping functionality has been removed

def create_input_switch_action(client, channel_id):
    """Create an input switch scheduled action"""
    # List available inputs for the channel
    inputs = list_channel_inputs(client, channel_id)
    if not display_inputs(inputs):
        print_error("Cannot create input switch without available inputs.")
        return False
    
    # Select input to switch to
    selected_input = select_input(inputs)
    if not selected_input:
        return False
    
    # Get schedule time
    advanced_notice = get_schedule_time()
    
    # Generate action name and event ID
    timeNow = datetime.now(timezone.utc)
    epochTime = datetime(1970, 1, 1, tzinfo=timezone.utc)
    eventId = int((timeNow-epochTime).total_seconds())
    actionName = f"InputSwitch_{eventId}"
    
    # Create schedule action start settings
    scheduleActionStartSettings = None
    if advanced_notice is not None:
        timeInsertion = timeNow + timedelta(seconds=advanced_notice)
        formattedTimeInsertion = timeInsertion.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3]+"Z"
        scheduleActionStartSettings = {
            "FixedModeScheduleActionStartSettings": {
                "Time": formattedTimeInsertion
            }
        }
        print_info(f"Scheduled insertion time: {formattedTimeInsertion}")
    else:
        scheduleActionStartSettings = {
            "ImmediateModeScheduleActionStartSettings": {}
        }
        print_info("Using immediate insertion")
    
    # Create the scheduled action body
    scheduledActionBody = {
        "ScheduleActions": [
            {
                "ActionName": actionName,
                "ScheduleActionStartSettings": scheduleActionStartSettings,
                "ScheduleActionSettings": {
                    "InputSwitchSettings": {
                        "InputAttachmentNameReference": selected_input.get('InputAttachmentName')
                    }
                }
            }
        ]
    }
    
    # Send the request
    try:
        print_header("Executing API Call")
        print_info(f"Calling batch_update_schedule for channel {channel_id}...")
        print_json("Request body", scheduledActionBody)
        
        response = client.batch_update_schedule(
            ChannelId=channel_id,
            Creates=scheduledActionBody
        )
        
        print_success("Input switch scheduled successfully!")
        print_json("Response", response)
        return True
    except Exception as e:
        print_error(f"Failed to schedule input switch: {str(e)}")
        return False

def create_input_prepare_action(client, channel_id):
    """Create an input prepare scheduled action"""
    # List available inputs for the channel
    inputs = list_channel_inputs(client, channel_id)
    if not display_inputs(inputs):
        print_error("Cannot create input prepare without available inputs.")
        return False
    
    # Select input to prepare
    selected_input = select_input(inputs)
    if not selected_input:
        return False
    
    # Get schedule time
    advanced_notice = get_schedule_time()
    
    # Generate action name and event ID
    timeNow = datetime.now(timezone.utc)
    epochTime = datetime(1970, 1, 1, tzinfo=timezone.utc)
    eventId = int((timeNow-epochTime).total_seconds())
    actionName = f"InputPrepare_{eventId}"
    
    # Create schedule action start settings
    scheduleActionStartSettings = None
    if advanced_notice is not None:
        timeInsertion = timeNow + timedelta(seconds=advanced_notice)
        formattedTimeInsertion = timeInsertion.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3]+"Z"
        scheduleActionStartSettings = {
            "FixedModeScheduleActionStartSettings": {
                "Time": formattedTimeInsertion
            }
        }
        print_info(f"Scheduled insertion time: {formattedTimeInsertion}")
    else:
        scheduleActionStartSettings = {
            "ImmediateModeScheduleActionStartSettings": {}
        }
        print_info("Using immediate insertion")
    
    # Create the scheduled action body
    scheduledActionBody = {
        "ScheduleActions": [
            {
                "ActionName": actionName,
                "ScheduleActionStartSettings": scheduleActionStartSettings,
                "ScheduleActionSettings": {
                    "InputPrepareSettings": {
                        "InputAttachmentNameReference": selected_input.get('InputAttachmentName')
                    }
                }
            }
        ]
    }
    
    # Send the request
    try:
        print_header("Executing API Call")
        print_info(f"Calling batch_update_schedule for channel {channel_id}...")
        print_json("Request body", scheduledActionBody)
        
        response = client.batch_update_schedule(
            ChannelId=channel_id,
            Creates=scheduledActionBody
        )
        
        print_success("Input prepare scheduled successfully!")
        print_json("Response", response)
        return True
    except Exception as e:
        print_error(f"Failed to schedule input prepare: {str(e)}")
        return False

def create_timesignal_provider_ad_action(client, channel_id):
    """Create a Timesignal Provider Advertisement insertion scheduled action"""
    # Get schedule time
    advanced_notice = get_schedule_time()
    
    # Get break duration
    while True:
        try:
            break_duration = int(input("\nEnter break duration in seconds (default: 30): ").strip() or "30")
            if break_duration <= 0:
                print_error("Break duration must be positive.")
                continue
            break
        except ValueError:
            print_error("Please enter a valid number.")
    
    # Generate action name and event ID
    timeNow = datetime.now(timezone.utc)
    epochTime = datetime(1970, 1, 1, tzinfo=timezone.utc)
    eventId = int((timeNow-epochTime).total_seconds())
    actionName = f"Scte35_{eventId}"
    
    # Create schedule action start settings
    scheduleActionStartSettings = None
    if advanced_notice is not None:
        timeInsertion = timeNow + timedelta(seconds=advanced_notice)
        formattedTimeInsertion = timeInsertion.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3]+"Z"
        scheduleActionStartSettings = {
            "FixedModeScheduleActionStartSettings": {
                "Time": formattedTimeInsertion
            }
        }
        print_info(f"Scheduled insertion time: {formattedTimeInsertion}")
    else:
        scheduleActionStartSettings = {
            "ImmediateModeScheduleActionStartSettings": {}
        }
        print_info("Using immediate insertion")
    
    # Create the scheduled action body
    scheduledActionBody = {
        "ScheduleActions": [
            {
                "ActionName": actionName,
                "ScheduleActionStartSettings": scheduleActionStartSettings,
                "ScheduleActionSettings": {
                    "Scte35TimeSignalSettings": {
                        "Scte35Descriptors": [
                            {
                                "Scte35DescriptorSettings": {
                                    "SegmentationDescriptorScte35DescriptorSettings": {
                                        "SubSegmentsExpected": 0,
                                        "SegmentationEventId": eventId,
                                        "SegmentationDuration": break_duration * 90000,  # Duration in 90kHz clock ticks
                                        "SegmentationCancelIndicator": "SEGMENTATION_EVENT_NOT_CANCELED",
                                        "SubSegmentNum": 0,
                                        "SegmentationUpidType": 12,
                                        "SegmentNum": 0,
                                        "SegmentationUpid": f"{eventId}",
                                        "SegmentationTypeId": 52,  # Provider Advertisement (52)
                                        "SegmentsExpected": 0
                                    }
                                }
                            }
                        ]
                    }
                }
            }
        ]
    }
    
    # Send the request
    try:
        print_header("Executing API Call")
        print_info(f"Calling batch_update_schedule for channel {channel_id}...")
        print_json("Request body", scheduledActionBody)
        
        response = client.batch_update_schedule(
            ChannelId=channel_id,
            Creates=scheduledActionBody
        )
        
        print_success("Timesignal Provider Advertisement scheduled successfully!")
        print_json("Response", response)
        return True
    except Exception as e:
        print_error(f"Failed to schedule Timesignal Provider Advertisement: {str(e)}")
        return False

def create_network_start_action(client, channel_id):
    """Create a Network Start SCTE-35 timesignal scheduled action"""
    # Get schedule time
    advanced_notice = get_schedule_time()
    
    # Get segmentation ID (optional)
    segmentation_id = input("\nEnter segmentation ID (hex, default: 10.1234/1234-1234-1234-1234-1234-C): ").strip()
    if not segmentation_id:
        segmentation_id = "10.1234/1234-1234-1234-1234-1234-C"
    
    # Generate action name and event ID
    timeNow = datetime.now(timezone.utc)
    epochTime = datetime(1970, 1, 1, tzinfo=timezone.utc)
    eventId = int((timeNow-epochTime).total_seconds())
    actionName = f"NetworkStart_{eventId}"
    
    # Create schedule action start settings
    scheduleActionStartSettings = None
    if advanced_notice is not None:
        timeInsertion = timeNow + timedelta(seconds=advanced_notice)
        formattedTimeInsertion = timeInsertion.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3]+"Z"
        scheduleActionStartSettings = {
            "FixedModeScheduleActionStartSettings": {
                "Time": formattedTimeInsertion
            }
        }
        print_info(f"Scheduled insertion time: {formattedTimeInsertion}")
    else:
        scheduleActionStartSettings = {
            "ImmediateModeScheduleActionStartSettings": {}
        }
        print_info("Using immediate insertion")

    # Create the scheduled action body with OrderedDict
    segment_settings = OrderedDict([
        ("SegmentationEventId", eventId),
        ("SegmentationCancelIndicator", "SEGMENTATION_EVENT_NOT_CANCELED"),
        ("SegmentationTypeId", 80),  # Network Start (0x50 = 80)
        ("SegmentationUpidType", 12),
        ("SegmentationUpid", convert_segmentation_id(segmentation_id)),
        ("SegmentationDuration", 0),
        ("SegmentNum", 0),
        ("SegmentsExpected", 0)
    ])

    # Create the scheduled action body
    scheduledActionBody = {
        "ScheduleActions": [
            {
                "ActionName": actionName,
                "ScheduleActionStartSettings": scheduleActionStartSettings,
                "ScheduleActionSettings": {
                    "Scte35TimeSignalSettings": {
                        "Scte35Descriptors": [
                            {
                                "Scte35DescriptorSettings": {
                                    "SegmentationDescriptorScte35DescriptorSettings": segment_settings
                                }
                            }
                        ]
                    }
                }
            }
        ]
    }
    
    # Send the request
    try:
        print_header("Executing API Call")
        print_info(f"Calling batch_update_schedule for channel {channel_id}...")
        print_json("Request body", scheduledActionBody)
        
        response = client.batch_update_schedule(
            ChannelId=channel_id,
            Creates=scheduledActionBody
        )
        
        print_success("Network Start scheduled successfully!")
        print_json("Response", response)
        return True
    except Exception as e:
        print_error(f"Failed to schedule Network Start: {str(e)}")
        return False

def create_network_end_action(client, channel_id):
    """Create a Network End SCTE-35 timesignal scheduled action"""
    # Get schedule time
    advanced_notice = get_schedule_time()
    
    # Get segmentation ID (optional)
    segmentation_id = input("\nEnter segmentation ID (hex, default: 10.1234/1234-1234-1234-1234-1234-C): ").strip()
    if not segmentation_id:
        segmentation_id = "10.1234/1234-1234-1234-1234-1234-C"

    # Generate action name and event ID
    timeNow = datetime.now(timezone.utc)
    epochTime = datetime(1970, 1, 1, tzinfo=timezone.utc)
    eventId = int((timeNow-epochTime).total_seconds())
    actionName = f"NetworkEnd_{eventId}"
    
    # Create schedule action start settings
    scheduleActionStartSettings = None
    if advanced_notice is not None:
        timeInsertion = timeNow + timedelta(seconds=advanced_notice)
        formattedTimeInsertion = timeInsertion.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3]+"Z"
        scheduleActionStartSettings = {
            "FixedModeScheduleActionStartSettings": {
                "Time": formattedTimeInsertion
            }
        }
        print_info(f"Scheduled insertion time: {formattedTimeInsertion}")
    else:
        scheduleActionStartSettings = {
            "ImmediateModeScheduleActionStartSettings": {}
        }
        print_info("Using immediate insertion")

    # Create the scheduled action body with OrderedDict
    segment_settings = OrderedDict([
        ("SegmentationEventId", eventId),
        ("SegmentationCancelIndicator", "SEGMENTATION_EVENT_NOT_CANCELED"),
        ("SegmentationTypeId", 81),  # Network End (0x51 = 81)
        ("SegmentationUpidType", 12),
        ("SegmentationUpid", convert_segmentation_id(segmentation_id)),
        ("SegmentationDuration", 0),
        ("SegmentNum", 0),
        ("SegmentsExpected", 0),
        ("DeliveryRestrictions", {
            "ArchiveAllowedFlag": "ARCHIVE_ALLOWED",
            "DeviceRestrictions": "NONE",
            "NoRegionalBlackoutFlag": "REGIONAL_BLACKOUT",
            "WebDeliveryAllowedFlag": "WEB_DELIVERY_NOT_ALLOWED"
        })
    ])

    # Create the scheduled action body
    scheduledActionBody = {
        "ScheduleActions": [
            {
                "ActionName": actionName,
                "ScheduleActionStartSettings": scheduleActionStartSettings,
                "ScheduleActionSettings": {
                    "Scte35TimeSignalSettings": {
                        "Scte35Descriptors": [
                            {
                                "Scte35DescriptorSettings": {
                                    "SegmentationDescriptorScte35DescriptorSettings": segment_settings
                                }
                            }
                        ]
                    }
                }
            }
        ]
    }
    
    # Send the request
    try:
        print_header("Executing API Call")
        print_info(f"Calling batch_update_schedule for channel {channel_id}...")
        print_json("Request body", scheduledActionBody)
        
        response = client.batch_update_schedule(
            ChannelId=channel_id,
            Creates=scheduledActionBody
        )
        
        print_success("Network End scheduled successfully!")
        print_json("Response", response)
        return True
    except Exception as e:
        print_error(f"Failed to schedule Network End: {str(e)}")
        return False

def create_static_image_overlay_action(client, channel_id):
    """Create a static image overlay scheduled action"""
    # Get schedule time
    advanced_notice = get_schedule_time()
    
    # Get image URL
    image_url = input("\nEnter the S3 URL for the image (e.g., s3://bucket/image.png): ").strip()
    if not image_url.startswith("s3://"):
        print_error("Invalid S3 URL format. URL must start with 's3://'")
        return False
    
    # StaticImageActivateSettings applies to all outputs, no need to specify output names
    
    # Get layer settings
    while True:
        try:
            layer = int(input("\nEnter layer (0-7, default: 0): ").strip() or "0")
            if 0 <= layer <= 7:
                # Store the layer in a global variable for deactivation
                global last_used_layer
                last_used_layer = layer
                break
            else:
                print_error("Layer must be between 0 and 7.")
        except ValueError:
            print_error("Please enter a valid number.")
    
    # Get opacity settings
    while True:
        try:
            opacity = int(input("\nEnter opacity percentage (0-100, default: 100): ").strip() or "100")
            if 0 <= opacity <= 100:
                break
            else:
                print_error("Opacity must be between 0 and 100.")
        except ValueError:
            print_error("Please enter a valid number.")
    
    # Get duration (optional)
    duration = None
    use_duration = input("\nDo you want to set a duration for this overlay? (y/n, default: n): ").strip().lower()
    if use_duration == 'y':
        while True:
            try:
                duration = int(input("Enter duration in milliseconds: ").strip())
                if duration > 0:
                    break
                else:
                    print_error("Duration must be positive.")
            except ValueError:
                print_error("Please enter a valid number.")
    
    # Generate action name and event ID
    timeNow = datetime.now(timezone.utc)
    epochTime = datetime(1970, 1, 1, tzinfo=timezone.utc)
    eventId = int((timeNow-epochTime).total_seconds())
    actionName = f"StaticImageOverlay_{eventId}"
    
    # Create schedule action start settings
    scheduleActionStartSettings = None
    if advanced_notice is not None:
        timeInsertion = timeNow + timedelta(seconds=advanced_notice)
        formattedTimeInsertion = timeInsertion.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3]+"Z"
        scheduleActionStartSettings = {
            "FixedModeScheduleActionStartSettings": {
                "Time": formattedTimeInsertion
            }
        }
        print_info(f"Scheduled insertion time: {formattedTimeInsertion}")
    else:
        scheduleActionStartSettings = {
            "ImmediateModeScheduleActionStartSettings": {}
        }
        print_info("Using immediate insertion")
    
    # Create the static image settings
    static_image_settings = {
        "Layer": layer,
        "ImageX": 0,
        "ImageY": 0,
        "Opacity": opacity,
        "FadeIn": 2000,  # 2 seconds fade in (milliseconds)
        "Image": {
            "PasswordParam": "",
            "Uri": image_url,
            "Username": ""
        }
    }
    
    # StaticImageActivateSettings doesn't support per-output rules
    print_info("StaticImageActivateSettings applies to all outputs")
    
    # Add duration if specified
    if duration is not None:
        static_image_settings["Duration"] = duration
    
    # Create the scheduled action body
    scheduledActionBody = {
        "ScheduleActions": [
            {
                "ActionName": actionName,
                "ScheduleActionStartSettings": scheduleActionStartSettings,
                "ScheduleActionSettings": {
                    "StaticImageActivateSettings": static_image_settings
                }
            }
        ]
    }
    
    # Send the request
    try:
        print_header("Executing API Call")
        print_info(f"Calling batch_update_schedule for channel {channel_id}...")
        print_json("Request body", scheduledActionBody)
        
        response = client.batch_update_schedule(
            ChannelId=channel_id,
            Creates=scheduledActionBody
        )
        
        print_success("Static image overlay scheduled successfully!")
        print_json("Response", response)
        return True
    except Exception as e:
        print_error(f"Failed to schedule static image overlay: {str(e)}")
        return False
def create_static_image_overlay_deactivate_action(client, channel_id):
    """Create a static image overlay deactivate scheduled action"""
    # Get schedule time
    advanced_notice = get_schedule_time()
    
    # StaticImageDeactivateSettings applies to all outputs, no need to specify output names
    
    # Use the last activated layer
    global last_used_layer
    layer = last_used_layer
    print_info(f"Using last activated layer: {layer}")
    
    # Generate action name and event ID
    timeNow = datetime.now(timezone.utc)
    epochTime = datetime(1970, 1, 1, tzinfo=timezone.utc)
    eventId = int((timeNow-epochTime).total_seconds())
    actionName = f"StaticImageOverlayDeactivate_{eventId}"
    
    # Create schedule action start settings
    scheduleActionStartSettings = None
    if advanced_notice is not None:
        timeInsertion = timeNow + timedelta(seconds=advanced_notice)
        formattedTimeInsertion = timeInsertion.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3]+"Z"
        scheduleActionStartSettings = {
            "FixedModeScheduleActionStartSettings": {
                "Time": formattedTimeInsertion
            }
        }
        print_info(f"Scheduled insertion time: {formattedTimeInsertion}")
    else:
        scheduleActionStartSettings = {
            "ImmediateModeScheduleActionStartSettings": {}
        }
        print_info("Using immediate insertion")
    
    # Create the static image deactivate settings
    static_image_deactivate_settings = {
        "Layer": layer,
        "FadeOut": 2000  # 2 seconds fade out (milliseconds)
    }
    
    # StaticImageDeactivateSettings doesn't support per-output rules
    print_info("StaticImageDeactivateSettings applies to all outputs")
    
    # Create the scheduled action body
    scheduledActionBody = {
        "ScheduleActions": [
            {
                "ActionName": actionName,
                "ScheduleActionStartSettings": scheduleActionStartSettings,
                "ScheduleActionSettings": {
                    "StaticImageDeactivateSettings": static_image_deactivate_settings
                }
            }
        ]
    }
    
    # Send the request
    try:
        print_header("Executing API Call")
        print_info(f"Calling batch_update_schedule for channel {channel_id}...")
        print_json("Request body", scheduledActionBody)
        
        response = client.batch_update_schedule(
            ChannelId=channel_id,
            Creates=scheduledActionBody
        )
        
        print_success("Static image overlay deactivation scheduled successfully!")
        print_json("Response", response)
        return True
    except Exception as e:
        print_error(f"Failed to schedule static image overlay deactivation: {str(e)}")
        return False


def convert_segmentation_id(segmentation_id):
    """
    Convert a segmentation ID to a valid 24-character hexadecimal format.
    
    Args:
        segmentation_id: The segmentation ID to convert (e.g., "10.1234/1234-1234-1234-1234-1234-C")
    
    Returns:
        A 24-character string containing only valid hexadecimal values
    """
    # 1. Remove characters preceding the first '.' in the string
    if '.' in segmentation_id:
        segmentation_id = segmentation_id.split('.', 1)[1]
    
    # 2. Remove characters following the final '-' in the string
    if '-' in segmentation_id:
        segmentation_id = segmentation_id.rsplit('-', 1)[0]
    
    # 3. Remove all '/', '-' or '.' characters
    segmentation_id = segmentation_id.replace('/', '').replace('-', '').replace('.', '')
    
    # Ensure the string contains only valid hexadecimal characters (0-9, a-f, A-F)
    hex_chars = ''.join(c for c in segmentation_id if c.lower() in '0123456789abcdef')
    
    # Pad or truncate to exactly 20 characters
    if len(hex_chars) < 24:
        hex_chars = hex_chars.ljust(20, '0')
    else:
        hex_chars = hex_chars[:24]
    
    return hex_chars

def signal_handler(sig, frame):
    """Handle keyboard interrupts gracefully"""
    print("\n")
    print_header("Exiting")
    print_info("Script terminated by user. Thank you for using the MediaLive Scheduled Actions Tool.")
    sys.exit(0)

def main():
    """Main function to run the script"""
    # Set up signal handler for Ctrl+C
    signal.signal(signal.SIGINT, signal_handler)
    
    print_header("MediaLive Scheduled Actions Tool")
    
    # Get AWS region
    region = get_aws_region()
    
    try:
        # Initialize AWS client
        print_info(f"Initializing AWS MediaLive client in region {region}")
        client = boto3.client("medialive", region_name=region)
        
        # List available channels
        print_info("Retrieving available MediaLive channels...")
        channels = list_medialive_channels(client)
        
        if not display_channels(channels):
            print_error("No MediaLive channels found. Exiting.")
            sys.exit(1)
        
        # Select a channel
        selected_channel = select_channel(channels)
        if not selected_channel:
            print_error("No channel selected. Exiting.")
            sys.exit(1)
        
        channel_id = selected_channel.get('Id')
        channel_name = selected_channel.get('Name')
        channel_state = selected_channel.get('State')
        
        print_success(f"Selected channel: {channel_name} (ID: {channel_id}, State: {channel_state})")
        
        # Main action loop
        while True:
            # Display action menu
            action = display_action_menu(client, channel_id)
            
            if action == 1:
                # Input Switch
                print_header("Input Switch")
                create_input_switch_action(client, channel_id)
            elif action == 2:
                # Input Prepare
                print_header("Input Prepare")
                create_input_prepare_action(client, channel_id)
            elif action == 3:
                # Insert Time Signal Provider Advertisement
                print_header("Insert Time Signal Provider Advertisement")
                create_timesignal_provider_ad_action(client, channel_id)
            elif action == 4:
                # Insert Network Start
                print_header("Insert Network Start")
                create_network_start_action(client, channel_id)
            elif action == 5:
                # Insert Network End
                print_header("Insert Network End")
                create_network_end_action(client, channel_id)
            elif action == 6:
                # Static Image Overlay (Activate)
                print_header("Static Image Overlay (Activate)")
                create_static_image_overlay_action(client, channel_id)
            elif action == 7:
                # Static Image Overlay (Deactivate)
                print_header("Static Image Overlay (Deactivate)")
                create_static_image_overlay_deactivate_action(client, channel_id)
            elif action == 8:
                # Exit
                print_header("Exiting")
                print_info("Thank you for using the MediaLive Scheduled Actions Tool.")
                break
            
            print("\n" + "-" * 80 + "\n")
            
    except Exception as e:
        print_error(f"An unexpected error occurred: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()