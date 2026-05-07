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


from pprint import pprint
import re
import sys
import yaml
import json
from collections import OrderedDict
import argparse
import os
import langcodes
from language_tags import tags

AUDIO_CODECS = [
    'AAC',
    'AC3',
    'EAC3'
]

VIDEO_CODECS = [
    'H_264',
    'H_265',
    'FRAME_CAPTURE'
]

# These are not really codecs. What is a better name?
CAPTION_CODECS= [
    "CAPTIONS"
]

# Complete list of supported codecs
SUPPORTED_CODECS = AUDIO_CODECS + VIDEO_CODECS + CAPTION_CODECS

OUTPUT_TYPES = [
    'mediatailor-hls-cmaf',
    'mediatailor-dash-cmaf',
    'medialive-hls-ts',
    'medialive-cmaf-ingest',
    'medialive-mediapackage'
]

default_output_path = "generated-profiles"

# Common configuration across HLS/TS and CMAF Ingest
availConfig = {
    "availSettings": {
        "scte35SpliceInsert": {
            "webDeliveryAllowedFlag": "FOLLOW",
            "noRegionalBlackoutFlag": "FOLLOW"
        }
    }
}
blackoutSlateConfig = {
    "networkEndBlackout": "ENABLED",
    "networkId": "10.1234/1234-1234-1234-1234-1234-C",
    "state": "ENABLED"
}

# Apply timescale multiplier to framerate
# Using a timescale multiplier is required to align the timescale in the output
#  of MediaConvert with the timescale in the MediaPackage V2 output
# Without a multiplier some players not compliant with the HLS standard could
# potentially encounter issues transitioning in and out of ad breaks.
timescaleMultiplier = 1000

# ctp_trickmode_settings is set in 'createCustomTranscodeProfile' when a
# frame_capture rendition is encountered. The equivalent of a MediaLive frame capture
# rendition in MediaConvert trickmode. 'ctp_trickmode_settings' caches the
# frame capture configuration to be used later for the generation of the MediaConvert
# trickmode configuration.
# This implementation only supports a single frame capture track and will throw an
# exception if more than one is encountered.
ctp_trickmode_settings = None

def main(argv):
    global ctp_trickmode_settings
    parser = argparse.ArgumentParser(description='Create a profile pair.')
    parser.add_argument('--config', type=str, required=True, help='Path to the configuration file')
    parser.add_argument('--version', type=str, required=True, help='Version number to append to profile names')
    parser.add_argument('--output-path', type=str, default=default_output_path, required=False, help='Path for generated profiles')
    args = parser.parse_args()
    config_file_path = args.config
    profile_version = args.version

    output_file_path = args.output_path

    # Check if the output path exists and create if it doesn't
    if not os.path.exists(output_file_path):
        os.makedirs(output_file_path) 

    # configuration from yaml configuration file
    with open(config_file_path, 'r') as config_file:
        config = yaml.safe_load(config_file)

    profile_set_name = get_filename_without_ext(config_file_path)

    for output_type in OUTPUT_TYPES:
        output_file = f"{output_type}-v{profile_version}.json"

        print("Generating '%s'" % output_type)
        if output_type in ['mediatailor-hls-cmaf', 'mediatailor-dash', 'mediatailor-dash-cmaf']:

            ctpOutput = createCustomTranscodeProfile( output_type, config )
            write_content_to_file(output_file_path + '/' + profile_set_name + '/' + output_file, ctpOutput)

            # Reset trickmode settings so multiple ctp can be generated
            ctp_trickmode_settings = None

        elif output_type == "medialive-hls-ts":

            mlOutput = generateMediaLiveHlsTsProfile( config )
            write_content_to_file(output_file_path + '/' + profile_set_name + '/' + output_file, mlOutput)

        elif output_type in "medialive-cmaf-ingest":

            mlOutput = generateMediaLiveCmafIngestProfile( config )
            write_content_to_file(output_file_path + '/' + profile_set_name + '/' + output_file, mlOutput)

        elif output_type == "medialive-mediapackage":

            mlOutput = generateMediaLiveMediaPackageProfile( config )
            write_content_to_file(output_file_path + '/' + profile_set_name + '/' + output_file, mlOutput)

        else:
            print("Unsupported output type: " + output_type)
            sys.exit(1)

        # print(output_file)

        # ctpOutput = createCustomTranscodeProfile( output_type, config )


def write_content_to_file(filename, content):
    try:
        # Create the directory if it doesn't exist
        directory = os.path.dirname(filename)
        if directory and not os.path.exists(directory):
            os.makedirs(directory)

        # Write content to the file
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(content)
    except OSError as e:
        error_message = f"Error writing to file '{filename}': {e}"
        print(error_message)
        sys.exit(1)  # Exit with a non-zero exit code
    except Exception as e:
        error_message = f"Unexpected error while writing to file '{filename}': {e}"
        print(error_message)
        sys.exit(1)  # Exit with a non-zero exit code


def generateMediaLiveHlsTsProfile( config ):

    outputsConfiguration = config['outputs']
    audioDescriptions = getMediaLiveAudioDescriptions( outputsConfiguration, 'HLS-TS' )
    captionDescriptions = getMediaLiveCaptionDescriptions(outputsConfiguration, 'HLS-TS')
    globalConfiguration = getMediaLiveGlobalConfiguration()
    videoDescriptions = getMediaLiveVideoDescriptions( outputsConfiguration, config['common'] )

    outputGroups = getMediaLiveHlsTsOutputGroups( outputsConfiguration )

    profileOutput = OrderedDict()
    profileOutput['audioDescriptions'] = audioDescriptions
    profileOutput['captionDescriptions'] = captionDescriptions
    profileOutput['globalConfiguration'] = globalConfiguration
    profileOutput['outputGroups'] = outputGroups
    profileOutput['timecodeConfig'] = { "source": "SYSTEMCLOCK" }
    profileOutput['videoDescriptions'] = videoDescriptions
    profileOutput['availConfiguration'] = availConfig
    profileOutput['blackoutSlate'] = blackoutSlateConfig

    # write ctp to a pretty format json string and maintain the order in the output
    profileOutputDump = json.dumps(profileOutput, indent=2, sort_keys=False)

    return profileOutputDump

def generateMediaLiveCmafIngestProfile( config ):

    outputsConfiguration = config['outputs']
    audioDescriptions = getMediaLiveAudioDescriptions( outputsConfiguration, 'CMAF-INGEST')
    captionDescriptions = getMediaLiveCaptionDescriptions(outputsConfiguration, 'CMAF-INGEST')
    globalConfiguration = getMediaLiveGlobalConfiguration()
    videoDescriptions = getMediaLiveVideoDescriptions( outputsConfiguration, config['common'] )


    outputGroups = getMediaLiveCmafIngestOutputGroups( outputsConfiguration, config['common'] )

    profileOutput = OrderedDict()
    profileOutput['audioDescriptions'] = audioDescriptions
    profileOutput['captionDescriptions'] = captionDescriptions
    profileOutput['globalConfiguration'] = globalConfiguration
    profileOutput['outputGroups'] = outputGroups
    profileOutput['timecodeConfig'] = { "source": "SYSTEMCLOCK" }
    profileOutput['videoDescriptions'] = videoDescriptions
    profileOutput['availConfiguration'] = availConfig
    profileOutput['blackoutSlate'] = blackoutSlateConfig

    # write ctp to a pretty format json string and maintain the order in the output
    profileOutputDump = json.dumps(profileOutput, indent=2, sort_keys=False)

    return profileOutputDump

def getMediaLiveHlsTsOutputGroups( outputs ):

    outputList = []
    # Set outputs for output group
    for output in outputs:
        if output['codec'] in VIDEO_CODECS:
            outputList.append({
                "captionDescriptionNames": [],
                "outputName": f"{output['name']}",
                "outputSettings": {
                    "mediaPackageOutputSettings": {}
                },
                "videoDescriptionName": f"{output['name']}"
            })
        elif output['codec'] in AUDIO_CODECS:
            audioDescriptionName = generateAudioDescriptionName( output['codec'], output['bitrate'], output['languageCode'] )
            outputList.append({
                "outputName": f"{output['name']}",
                "captionDescriptionNames": [],
                "outputSettings": {
                    "mediaPackageOutputSettings": {}
                },
                "audioDescriptionNames": [audioDescriptionName]
            })
        elif output['codec'] in CAPTION_CODECS:
            captionDescriptionName = generateCaptionsDescriptionName(output['languageCode'])
            outputList.append({
                "outputName": f"{output['name']}",
                "outputSettings": {
                    "mediaPackageOutputSettings": {}
                },
                "captionDescriptionNames": [captionDescriptionName]
            })
        else:
            print(f"Unsupported codec: {output['codec']}")
            sys.exit(1)

    outputGroups = [
        {
            "outputGroupSettings": {
                "mediaPackageGroupSettings": {
                    "destination": {
                        "destinationRefId": "media-destination"
                    }
                }
            },
            "name": "HLS",
            "outputs": outputList
        }
    ]

    return outputGroups

def getMediaLiveCmafIngestOutputGroups( outputs, commonCfg ):

    outputList = []
    # Set outputs for output group
    for output in outputs:
        if output['codec'] in VIDEO_CODECS:

            renditionDescriptionName = ""
            if output['codec'] == 'FRAME_CAPTURE':
                renditionDescriptionName = generateFrameCaptureDescriptionName( output['codec'], output['height'] )
            else:
                renditionDescriptionName = generateVideoDescriptionName( output['codec'], output['maxBitrate'] )

            outputList.append({
                "captionDescriptionNames": [],
                "outputName": f"{output['name']}",
                "outputSettings": {
                    "cmafIngestOutputSettings": {
                        "nameModifier": renditionDescriptionName
                    }
                },
                "videoDescriptionName": f"{output['name']}"
            })
        elif output['codec'] in AUDIO_CODECS:
            audioDescriptionName = generateAudioDescriptionName( output['codec'], output['bitrate'], output['languageCode'] )
            outputList.append({
                "outputName": f"{output['name']}",
                "captionDescriptionNames": [],
                "outputSettings": {
                    "cmafIngestOutputSettings": {
                        "nameModifier": audioDescriptionName
                    }
                },
                "audioDescriptionNames": [audioDescriptionName]
            })
        elif output['codec'] == 'CAPTIONS':
            captionsDescriptionName = generateCaptionsDescriptionName(output['languageCode'])
            outputList.append({
                "outputName": f"{output['name']}",
                "captionDescriptionNames": [captionsDescriptionName],
                "outputSettings": {
                    "cmafIngestOutputSettings": {
                        "nameModifier": captionsDescriptionName
                    }
                },
                "audioDescriptionNames": []
            })
        else:
            print(f"Unsupported codec: {output['codec']}")
            sys.exit(1)

    outputGroups = [
        {
            "outputGroupSettings": {
                "cmafIngestGroupSettings": {
                    "destination": {
                        "destinationRefId": "media-destination"
                    },
                    "nielsenId3Behavior": "NO_PASSTHROUGH",
                    "scte35Type": "SCTE_35_WITHOUT_SEGMENTATION",
                    "segmentLength": commonCfg["segmentLength"],
                    "segmentLengthUnits": "SECONDS"
                }
            },
            "name": "CMAFIngest",
            "outputs": outputList
        }
    ]

    return outputGroups

def validateVideoConfig(output, commonConfig):
    """
    Validate video encoding configuration parameters.
    Raises ValueError for invalid configurations.
    Prints warnings for potentially problematic configurations.
    """
    # Validate rate control mode
    rateControlMode = output.get('rateControlMode', commonConfig.get('rateControlMode', 'QVBR'))
    if rateControlMode not in ['CBR', 'QVBR', 'VBR']:
        raise ValueError(f"Invalid rateControlMode '{rateControlMode}' for {output.get('name', 'unknown')}. Must be CBR, QVBR, or VBR.")
    
    # Validate GOP B-frames range (0-7 is typical MediaLive range)
    gopNumBFrames = output.get('gopNumBFrames', commonConfig.get('gopNumBFrames', 3))
    if not isinstance(gopNumBFrames, int) or not 0 <= gopNumBFrames <= 7:
        raise ValueError(f"gopNumBFrames must be integer 0-7 for {output.get('name', 'unknown')}, got: {gopNumBFrames}")
    
    # Validate number of reference frames (1-6 is typical range)
    numRefFrames = output.get('numRefFrames', commonConfig.get('numRefFrames', 3))
    if not isinstance(numRefFrames, int) or not 1 <= numRefFrames <= 6:
        raise ValueError(f"numRefFrames must be integer 1-6 for {output.get('name', 'unknown')}, got: {numRefFrames}")
    
    # Validate sharpness range
    sharpness = output.get('sharpness', commonConfig.get('sharpness', 100))
    if not isinstance(sharpness, int) or not 0 <= sharpness <= 100:
        raise ValueError(f"sharpness must be integer 0-100 for {output.get('name', 'unknown')}, got: {sharpness}")
    
    # Validate GOP size is positive
    gopSize = output.get('gopSize', commonConfig.get('gopSize'))
    if gopSize is not None and (not isinstance(gopSize, (int, float)) or gopSize <= 0):
        raise ValueError(f"gopSize must be positive number for {output.get('name', 'unknown')}, got: {gopSize}")

def getMediaLiveVideoDescriptions( outputs, commonConfig ):

    videoDescriptions = []

    # Configure video descriptions
    for output in outputs:
        if output['codec'] not in VIDEO_CODECS:
            continue

        # Validate configuration before processing
        validateVideoConfig(output, commonConfig)

        # Check for a gopSize override
        gopSize = commonConfig['gopSize']
        if 'gopSize' in output:
            gopSize = output['gopSize']

        # Check for a video codec profile override
        videoCodecProfile = ""
        if 'codecProfile' in output:
            videoCodecProfile = output['codecProfile']
        elif 'videoCodecProfile' in commonConfig:
            videoCodecProfile = commonConfig['videoCodecProfile']
        else:
            raise Exception('Unable to find a specified codecProfile.')

        # Get framerate settings (supports both old and new format)
        framerateNumerator, framerateDenominator = getFramerateSettings(output, commonConfig)

        # Check for a video lookahead rate control override
        videoLookAheadRateControl = ""
        if 'lookAheadRateControl' in output:
            videoLookAheadRateControl = output['lookAheadRateControl']
        elif 'videoLookAheadRateControl' in commonConfig:
            videoLookAheadRateControl = commonConfig['videoLookAheadRateControl']
        else:
            raise Exception('Unable to find a specified lookAheadRateControl.')

        # Check for a videoCodecProfileTier override
        videoCodecTier = getVideoCodecProfileTier( output, commonConfig )

        # Check for buffer size Value
        bufSize = None
        if 'bufSize' in output:
            bufSize = output['bufSize']

        # Check for rate control mode override
        rateControlMode = output.get('rateControlMode', commonConfig.get('rateControlMode', 'QVBR'))

        # Check for GOP B-frames override
        gopNumBFrames = output.get('gopNumBFrames', commonConfig.get('gopNumBFrames', 3))

        # Check for number of reference frames override
        numRefFrames = output.get('numRefFrames', commonConfig.get('numRefFrames', 3))

        # Check for GOP B reference override
        gopBReference = output.get('gopBReference', commonConfig.get('gopBReference', 'ENABLED'))

        # Check for subgop length override
        subgopLength = output.get('subgopLength', commonConfig.get('subgopLength', 'DYNAMIC'))

        # Check for sharpness override
        sharpness = output.get('sharpness', commonConfig.get('sharpness', 100))

        # Check for color metadata override
        colorMetadata = output.get('colorMetadata', commonConfig.get('colorMetadata', 'INSERT'))

        # Check for timecode burnin override
        timecodeBurnin = output.get('timecodeBurnin', commonConfig.get('timecodeBurnin', True))

        videoDescription = {}
        if output['codec'] == 'H_264':
            h264Settings = {
                "afdSignaling": "NONE",
                "colorMetadata": colorMetadata,
                "adaptiveQuantization": "AUTO",
                "entropyEncoding": "CABAC",
                "flickerAq": "ENABLED",
                "framerateControl": "SPECIFIED",
                "framerateNumerator": framerateNumerator,
                "framerateDenominator": framerateDenominator,
                "gopBReference": gopBReference,
                "gopClosedCadence": 1,
                "gopNumBFrames": gopNumBFrames,
                "gopSize": gopSize,
                "gopSizeUnits": commonConfig['gopSizeUnits'],
                "subgopLength": subgopLength,
                "scanType": "PROGRESSIVE",
                "level": "H264_LEVEL_AUTO",
                "lookAheadRateControl": videoLookAheadRateControl,
                "numRefFrames": numRefFrames,
                "parControl": "SPECIFIED",
                "parDenominator": 1,
                "parNumerator": 1,
                "profile": videoCodecProfile,
                "rateControlMode": rateControlMode,
                "syntax": "DEFAULT",
                "sceneChangeDetect": "ENABLED",
                "spatialAq": "ENABLED",
                "temporalAq": "ENABLED",
                "timecodeInsertion": "DISABLED"
            }

            # Add maxBitrate or bitrate based on rate control mode
            if rateControlMode == 'CBR':
                h264Settings['bitrate'] = output['maxBitrate']
                if not bufSize:
                    recommended_bufsize = int(output['maxBitrate'] * 0.666)
                    print(f"WARNING: CBR mode for {output['name']} without bufSize - recommend bufSize = {recommended_bufsize}")
            else:
                h264Settings['maxBitrate'] = output['maxBitrate']

            # Set the buffer size if it has been defined
            if bufSize:
                h264Settings['bufSize'] = bufSize

            # Add timecode burnin if enabled
            if timecodeBurnin:
                h264Settings['timecodeBurninSettings'] = {
                    "fontSize": getTimecodeBurninFontSize( output['height'] ),
                    "position": "TOP_LEFT",
                    "prefix": ""
                }

            videoDescription = {
                "codecSettings": {
                    "h264Settings": h264Settings
                },
                "height": output['height'],
                "name": f"{output['name']}",
                "respondToAfd": "NONE",
                "sharpness": sharpness,
                "scalingBehavior": "DEFAULT",
                "width": output['width']
            }

        elif output['codec'] == 'H_265':
            h265Settings = {
                "adaptiveQuantization": "AUTO",
                "afdSignaling": "NONE",
                "alternativeTransferFunction": "OMIT",
                "colorMetadata": colorMetadata,
                "flickerAq": "ENABLED",
                "framerateDenominator": framerateDenominator,
                "framerateNumerator": framerateNumerator,
                "gopClosedCadence": 1,
                "gopNumBFrames": gopNumBFrames,
                "gopSize": gopSize,
                "gopSizeUnits": commonConfig['gopSizeUnits'],
                "level": "H265_LEVEL_AUTO",
                "lookAheadRateControl": videoLookAheadRateControl,
                "mvOverPictureBoundaries": "ENABLED",
                "mvTemporalPredictor": "ENABLED",
                "parDenominator": 1,
                "parNumerator": 1,
                "profile": videoCodecProfile,
                "rateControlMode": rateControlMode,
                "scanType": "PROGRESSIVE",
                "sceneChangeDetect": "ENABLED",
                "tier": videoCodecTier,
                "tilePadding": "NONE",
                "timecodeInsertion": "DISABLED",
                "treeblockSize": "AUTO"
            }

            # Add maxBitrate or bitrate based on rate control mode
            if rateControlMode == 'CBR':
                h265Settings['bitrate'] = output['maxBitrate']
                if not bufSize:
                    recommended_bufsize = int(output['maxBitrate'] * 0.666)
                    print(f"WARNING: CBR mode for {output['name']} without bufSize - recommend bufSize = {recommended_bufsize}")
            else:
                h265Settings['maxBitrate'] = output['maxBitrate']

            # Set the buffer size if it has been defined
            if bufSize:
                h265Settings['bufSize'] = bufSize

            # Add timecode burnin if enabled
            if timecodeBurnin:
                h265Settings['timecodeBurninSettings'] = {
                    "fontSize": getTimecodeBurninFontSize( output['height'] ),
                    "position": "TOP_LEFT"
                }

            videoDescription = {
                "codecSettings": {
                    "h265Settings": h265Settings
                },
                "height": output['height'],
                "name": f"{output['name']}",
                "respondToAfd": "NONE",
                "sharpness": sharpness,
                "scalingBehavior": "DEFAULT",
                "width": output['width']
            }

        elif output['codec'] == 'FRAME_CAPTURE':
            videoDescription = {
                "codecSettings": {
                    "frameCaptureSettings": {}
                },
                "height": output['height'],
                "name": output['name'],
                "respondToAfd": "NONE",
                "scalingBehavior": "DEFAULT",
                "sharpness": 50,
                "width": output['width']
            }

        else:
            print("Unsupported codec: " + output['codec'])
            sys.exit(1)

        videoDescriptions.append(videoDescription)

    return videoDescriptions

def generateFrameCaptureDescriptionName(codec, height):
    return f"framecapture_{height}"

def generateVideoDescriptionName(codec, bitrate):
    return f"video_{codec.lower().replace('-', '')}_{bitrate}"

def generateAudioDescriptionName(codec, bitrate, language):
    language = replaceDashWithUnderscore( language )
    return f"audio_{codec.lower().replace('-', '')}_{bitrate}_{language}"

def generateCaptionsDescriptionName(language):
    language = replaceDashWithUnderscore( language )
    return f"captions_{language}"

def replaceDashWithUnderscore( stringValue ):
    return stringValue.replace('-', '_')

def getMediaLiveAudioDescriptions( outputs, outputGroupType ):

    validateOutputGroupType(outputGroupType)

    audioDescriptions = []

    # Configure audio descriptions
    for output in outputs:
        if output['codec'] not in AUDIO_CODECS:
            continue

        audioDescription = {}
        languageCode = formatLanguageCodeToRfc5646(output['languageCode'])
        audioDescriptionName = generateAudioDescriptionName( output['codec'], output['bitrate'], output['languageCode'] )

        # Base audio description structure
        audioDescription = {
            "audioTypeControl": "FOLLOW_INPUT",
            "languageCode": languageCode,
            "languageCodeControl": "USE_CONFIGURED",
            "audioSelectorName": "default",  # Fixed typo: was "auldioSelectorName"
            "name": audioDescriptionName,
            "streamName": output['streamName']
        }
        
        # Codec-specific settings
        codec_settings = {
            'AAC': {
                "aacSettings": {
                    "inputType": "NORMAL",
                    "bitrate": output['bitrate'],
                    "codingMode": output['codingMode'],
                    "rawFormat": "NONE",
                    "spec": "MPEG4",
                    "profile": output['codingProfile'],
                    "rateControlMode": "CBR",
                    "sampleRate": output['sampleRate']
                }
            },
            'AC3': {
                "ac3Settings": {
                    "bitrate": output['bitrate'],
                    "bitstreamMode": "COMPLETE_MAIN",
                    "codingMode": output['codingMode'],
                    "dialnorm": 24,
                    "drcProfile": "NONE",
                    "lfeFilter": "ENABLED",
                    "metadataControl": "USE_CONFIGURED"
                }
            },
            'EAC3': {
                "eac3Settings": {
                    "attenuationControl": "NONE",
                    "bitrate": output['bitrate'],
                    "bitstreamMode": "COMPLETE_MAIN",
                    "codingMode": output['codingMode'],
                    "dcFilter": "ENABLED",
                    "dialnorm": 24,
                    "drcLine": "NONE",
                    "drcRf": "NONE",
                    "lfeControl": "LFE",
                    "lfeFilter": "ENABLED",
                    "loRoCenterMixLevel": -3,
                    "loRoSurroundMixLevel": -3,
                    "ltRtCenterMixLevel": -3,
                    "ltRtSurroundMixLevel": -3,
                    "metadataControl": "FOLLOW_INPUT",
                    "passthroughControl": "NO_PASSTHROUGH",
                    "phaseControl": "SHIFT_90_DEGREES",
                    "stereoDownmix": "NOT_INDICATED",
                    "surroundExMode": "DISABLED",
                    "surroundMode": "NOT_INDICATED"
                }
            }
        }
        
        if output['codec'] not in codec_settings:
            print(f"Unsupported audio codec: {output['codec']}")
            sys.exit(1)
            
        audioDescription["codecSettings"] = codec_settings[output['codec']]

        audioDescriptions.append(audioDescription)

    # Set the first audio rendition as the default (MAIN) for CMAF-INGEST and MEDIAPACKAGE only
    if audioDescriptions and outputGroupType in ['CMAF-INGEST', 'MEDIAPACKAGE']:
        first_audio = audioDescriptions[0]
        if 'audioDashRoles' not in first_audio:
            first_audio['audioDashRoles'] = []
        if 'MAIN' not in first_audio['audioDashRoles']:
            first_audio['audioDashRoles'].append('MAIN')

    return audioDescriptions

def getMediaLiveCaptionDescriptions( outputs, outputGroupType ):

    validateOutputGroupType(outputGroupType)

    captionsDescriptions = []

    # Configure caption descriptions
    for output in outputs:
        if output['codec'] not in CAPTION_CODECS:
            continue

        captionsDescription = {}
        languageCode = formatLanguageCodeToRfc5646(output['languageCode'])
        captionsDescriptionName = generateCaptionsDescriptionName( output['languageCode'] )

        # Base caption description structure
        captionsDescription = {
            "name": captionsDescriptionName,
            "languageCode": languageCode,
            "languageDescription": output['languageDescription'],
            "captionSelectorName": output['captionsSelectorName']
        }
        
        # Output group type specific settings
        group_settings = {
            'CMAF-INGEST': {
                "accessibility": output['accessibility'],
                "destinationSettings": {
                    "ttmlDestinationSettings": {
                        "styleControl": output['styleControl']
                    }
                }
            },
            'MEDIAPACKAGE': {
                "accessibility": output['accessibility'],
                "destinationSettings": {
                    "ttmlDestinationSettings": {
                        "styleControl": output['styleControl']
                    }
                }
            },
            'HLS-TS': {
                "destinationSettings": {
                    "webvttDestinationSettings": {}
                }
            }
        }

            
        captionsDescription.update(group_settings[outputGroupType])
        captionsDescriptions.append(captionsDescription)

    return captionsDescriptions

def validateOutputGroupType(outputGroupType):
    SUPPORTED_OUTPUTGROUP_TYPES=['HLS-TS','CMAF-INGEST','MEDIAPACKAGE']
    if outputGroupType not in SUPPORTED_OUTPUTGROUP_TYPES:
        # create a string concatenating all values of SUPPORTED_OUTPUTGROUP_TYPES separated by '|'
        supportedOutputGroupTypesString = ' | '.join(SUPPORTED_OUTPUTGROUP_TYPES)
        raise Exception('Invalid outputGroupType [%s]. Supported Types: %s' % ( outputGroupType, supportedOutputGroupTypesString ))

def getMediaLiveGlobalConfiguration():

    globalConfiguration = {
      "inputEndAction": "NONE",
      "outputLockingMode": "PIPELINE_LOCKING",
      "outputTimingSource": "SYSTEM_CLOCK",
      "supportLowFramerateInputs": "DISABLED"
    }

    return globalConfiguration

def createCustomTranscodeProfile( profileType, config):

    global ctp_trickmode_settings
    commonConfig = config["common"]
    timecodeConfig = getTimecodeConfig()
    adAvailOffset = 0
    includeCaptionSelector = False


    videoContainerSettings = None
    audioContainerSettings = None
    if profileType == "mediatailor-hls-cmaf":
        videoContainerSettings = {
            "Container": "CMFC"        }
        audioContainerSettings = {
            "Container": "CMFC",
            "CmfcSettings": {
                "AudioDuration": "MATCH_VIDEO_DURATION"
            }
        }
    elif profileType == "mediatailor-dash-cmaf":
        videoContainerSettings = {
            "Container": "CMFC"
        }
        audioContainerSettings = {
            "Container": "CMFC",
            "CmfcSettings": {
                "AudioDuration": "MATCH_VIDEO_DURATION"
            }
        }
    else:
        videoContainerSettings = {
            "Container": "MPD",
            "MpdSettings": {
                "CaptionContainerType": "RAW",
                "Scte35Source": "NONE",
                "Scte35Esam": "NONE",
                "AudioDuration": "MATCH_VIDEO_DURATION"
            }
        }

        audioContainerSettings = {
            "Container": "MPD",
            "MpdSettings": {
                "AudioDuration": "MATCH_VIDEO_DURATION"
            }
        }

        captionsContainerSettings = {
            "Container": "MPD",
            "MpdSettings": {
                "CaptionContainerType": "FRAGMENTED_MP4"
            }
        }

    # generate output for each output in configuration file
    outputs = []
    for outputCfg in config['outputs']:

        output = None


        # Set the language code
        languageCode = ""
        if 'languageCode' in outputCfg.keys():
            languageCode = formatLanguageCodeToCapitalizedIso639_2(outputCfg["languageCode"])

        # Raise error if codec is not supported
        if outputCfg['codec'] not in SUPPORTED_CODECS:
            raise Exception('Codec not supported: ' + outputCfg['codec'])
        
        if outputCfg['codec'] == 'CAPTIONS':
            if profileType != "mediatailor-dash":
                print("Skipping track because codec is not supported for %s profiles" % profileType)
                continue
            else:
                includeCaptionSelector = True        

        if outputCfg['codec'] == "H_264":
            output = {
                "ContainerSettings": videoContainerSettings,
                "VideoDescription": getH264VideoDescription(outputCfg, commonConfig),
                "NameModifier": outputCfg['name']
            }
        elif outputCfg['codec'] == "H_265":
            output = {
                "ContainerSettings": videoContainerSettings,
                "VideoDescription": getH265VideoDescription(outputCfg, commonConfig),
                "NameModifier": outputCfg['name']
            }
        elif outputCfg['codec'] == "AAC":

            output = {
                "ContainerSettings": audioContainerSettings,
                "AudioDescriptions": [
                    {
                        "AudioSourceName": "Audio Selector 1",
                        "AudioNormalizationSettings": {
                            "TargetLkfs": outputCfg["audioNormalIzationSettings"]["targetLkfs"],
                        },
                        "CodecSettings": {
                            "Codec": "AAC",
                            "AacSettings": {
                                "Bitrate": outputCfg["bitrate"],
                                "CodecProfile": outputCfg["codingProfile"],
                                "CodingMode": outputCfg["codingMode"],
                                "SampleRate": outputCfg["sampleRate"]
                            }
                        },
                        "StreamName": outputCfg['streamName'],
                        "LanguageCodeControl": "USE_CONFIGURED" if outputCfg['languageCode'] else "FOLLOW_INPUT",
                        "LanguageCode": languageCode
                    }
                ],
                "NameModifier": outputCfg['name']
            }

        elif outputCfg['codec'] == "AC3":

            output = {
                "ContainerSettings": audioContainerSettings,
                "AudioDescriptions": [
                    {
                        "AudioTypeControl": "USE_CONFIGURED",
                        "AudioSourceName": "Audio Selector 1",
                        "AudioNormalizationSettings": {
                            "Algorithm": outputCfg["audioNormalIzationSettings"]["algorithm"],
                            "AlgorithmControl": outputCfg["audioNormalIzationSettings"]["algorithmControl"],
                            "LoudnessLogging": "DONT_LOG",
                            "TargetLkfs": outputCfg["audioNormalIzationSettings"]["targetLkfs"],
                            "PeakCalculation": "NONE"
                        },
                        "CodecSettings": {
                            "Codec": "AC3",
                            "Ac3Settings": {
                                "Bitrate": outputCfg["bitrate"],
                                "CodingMode": outputCfg["codingMode"],
                                "Dialnorm": outputCfg["dialNorm"]
                            }
                        },
                        "StreamName": outputCfg['streamName'],
                        "LanguageCodeControl": "USE_CONFIGURED" if outputCfg['languageCode'] else "FOLLOW_INPUT",
                        "LanguageCode": languageCode
                    }
                ],
                "NameModifier": outputCfg['name']
            }
        
        elif outputCfg['codec'] == "EAC3":

            output = {
                "ContainerSettings": audioContainerSettings,
                "AudioDescriptions": [
                    {
                        "AudioTypeControl": "USE_CONFIGURED",
                        "AudioSourceName": "Audio Selector 1",
                        "AudioNormalizationSettings": {
                            "Algorithm": outputCfg["audioNormalIzationSettings"]["algorithm"],
                            "AlgorithmControl": outputCfg["audioNormalIzationSettings"]["algorithmControl"],
                            "LoudnessLogging": "DONT_LOG",
                            "TargetLkfs": outputCfg["audioNormalIzationSettings"]["targetLkfs"],
                            "PeakCalculation": "NONE"
                        },
                        "CodecSettings": {
                            "Codec": "EAC3",
                            "Eac3Settings": {
                                "Dialnorm": outputCfg["dialNorm"], 
                                "Bitrate": outputCfg["bitrate"],
                                "CodingMode": outputCfg["codingMode"]
                            }
                        },
                        "StreamName": outputCfg['streamName'],
                        "LanguageCodeControl": "USE_CONFIGURED" if outputCfg['languageCode'] else "FOLLOW_INPUT",
                        "LanguageCode": languageCode
                    }
                ],
                "NameModifier": outputCfg['name']
            }

        elif outputCfg['codec'] == "CAPTIONS":
            output = {
                "ContainerSettings": captionsContainerSettings,
                "NameModifier": outputCfg['name'],
                "CaptionDescriptions": [
                    {
                        "CaptionSelectorName": outputCfg['captionsSelectorName'],
                        "DestinationSettings": {
                            "DestinationType": "TTML",
                            "TtmlDestinationSettings": {
                            }
                        },
                        "LanguageCode": languageCode
                    }
                ]
            }
        elif outputCfg['codec'] == "FRAME_CAPTURE":
            if ctp_trickmode_settings is None:
                # cache settings to use in the configuration of trickmode
                ctp_trickmode_settings = outputCfg
            else:
                raise Exception('Implementation only supports a single frame capture rendition')
        else:
            # Raise error as the output is not supported
            raise Exception('Output not supported: ' + outputCfg['codec'])

        if output is not None:
            outputs.append(output)


    # Set output group settings
    outputGroup = OrderedDict()
    if profileType == "mediatailor-hls-cmaf":
        outputGroup = getCmafOutputGroup( outputGroup, outputs, config )
    elif profileType == "mediatailor-dash-cmaf":
        outputGroup = getDashCmafOutputGroup( outputGroup, outputs, config )
    else:
        outputGroup = getDashOutputGroup(outputGroup, outputs, config)

    ctpOutputFile = OrderedDict()
    ctpOutputFile["TimecodeConfig"] = timecodeConfig
    ctpOutputFile["OutputGroups"] = [ outputGroup ]
    ctpOutputFile["Inputs"] = getInputs( includeCaptionSelector )

    # write ctp to a pretty format json string and maintain the order in the output
    ctpOutput = json.dumps(ctpOutputFile, indent=4, sort_keys=False)

    return ctpOutput

def getDashOutputGroup( outputGroup, outputs, config ):

    commonCfg = config["common"]

    outputGroup["Name"] = "DASH ISO"
    outputGroup["Outputs"] = outputs
    outputGroup["OutputGroupSettings"] = {
        "Type": "DASH_ISO_GROUP_SETTINGS",
        "DashIsoGroupSettings": {
            "SegmentLength": commonCfg["segmentLength"],
            "SegmentLengthControl": "GOP_MULTIPLE",
            "MinFinalSegmentLength": 1,
            "Destination": "s3://bucket/main",
            "FragmentLength": commonCfg["fragmentLength"],
            "SegmentControl": "SEGMENTED_FILES",
            "MpdProfile": "MAIN_PROFILE",
            "HbbtvCompliance": "NONE",
            "WriteSegmentTimelineInRepresentation": "ENABLED",
            "DashIFrameTrickPlayNameModifier": "_iframe",
            "DashManifestStyle": "BASIC"
        }
    }

    # Configure Trickplay Track
    ( imageBasedTrickPlayMode, imageBasedTrickPlaySettings ) = getTrickmodeSettings()
    if imageBasedTrickPlayMode and imageBasedTrickPlaySettings:
        outputGroup["OutputGroupSettings"][ "DashIsoGroupSettings"]["ImageBasedTrickPlay"] = imageBasedTrickPlayMode
        outputGroup["OutputGroupSettings"][ "DashIsoGroupSettings"]["ImageBasedTrickPlaySettings"] = imageBasedTrickPlaySettings

    return outputGroup

def getDashCmafOutputGroup( outputGroup, outputs, config ):

    commonCfg = config["common"]

    outputGroup["Name"] = "CMAF"
    outputGroup["Outputs"] = outputs
    outputGroup["OutputGroupSettings"] = {
        "Type": "CMAF_GROUP_SETTINGS",
        "CmafGroupSettings": {
            "WriteHlsManifest": "DISABLED",
            "WriteDashManifest": "ENABLED",
            "SegmentLength": commonCfg["segmentLength"],
            "SegmentLengthControl": "GOP_MULTIPLE",
            "MinFinalSegmentLength": 1,
            "Destination": "s3://bucket/main/",
            "FragmentLength": commonCfg["fragmentLength"],
            "SegmentControl": "SEGMENTED_FILES",
            "DashManifestStyle": "COMPACT"
        }
    }

    # Configure Trickplay Track
    ( imageBasedTrickPlayMode, imageBasedTrickPlaySettings ) = getTrickmodeSettings()
    if imageBasedTrickPlayMode and imageBasedTrickPlaySettings:
        outputGroup["OutputGroupSettings"][ "CmafGroupSettings"]["ImageBasedTrickPlay"] = imageBasedTrickPlayMode
        outputGroup["OutputGroupSettings"][ "CmafGroupSettings"]["ImageBasedTrickPlaySettings"] = imageBasedTrickPlaySettings

    return outputGroup

def getCmafOutputGroup( outputGroup, outputs, config ):

    commonCfg = config["common"]

    outputGroup["Name"] = "CMAF"
    outputGroup["Outputs"] = outputs
    outputGroup["OutputGroupSettings"] = {
        "Type": "CMAF_GROUP_SETTINGS",
        "CmafGroupSettings": {
            "WriteHlsManifest": "ENABLED",
            "WriteDashManifest": "DISABLED",
            "SegmentLength": commonCfg["segmentLength"],
            "SegmentLengthControl": "GOP_MULTIPLE",
            "MinFinalSegmentLength": 1,
            "Destination": "s3://bucket/main/",
            "FragmentLength": commonCfg["fragmentLength"],
            "SegmentControl": "SEGMENTED_FILES",
            "ManifestDurationFormat": "FLOATING_POINT",
        }
    }

    # Configure Trickplay Track
    ( imageBasedTrickPlayMode, imageBasedTrickPlaySettings ) = getTrickmodeSettings()
    if imageBasedTrickPlayMode and imageBasedTrickPlaySettings:
        outputGroup["OutputGroupSettings"][ "CmafGroupSettings"]["ImageBasedTrickPlay"] = imageBasedTrickPlayMode
        outputGroup["OutputGroupSettings"][ "CmafGroupSettings"]["ImageBasedTrickPlaySettings"] = imageBasedTrickPlaySettings

    return outputGroup


def getTrickmodeSettings():

    # No trickmode defined, return empty result
    if ctp_trickmode_settings is None:
        return (None, None)

    # Use frame capture rendition settings to determin image based
    # trickplay settings
    imageBasedTrickPlayMode = "ADVANCED"
    imageBasedTrickPlaySettings = {
        "ThumbnailHeight": ctp_trickmode_settings["height"],
        "ThumbnailWidth": ctp_trickmode_settings["width"],
        "TileHeight": 1,
        "TileWidth": 1,
        "IntervalCadence": "FOLLOW_IFRAME"
    }
    
    return (imageBasedTrickPlayMode, imageBasedTrickPlaySettings)

def getFramerateSettings(outputCfg, commonCfg):
    """
    Get framerate numerator and denominator from config.
    Supports both new format (explicit numerator/denominator) and old format (integer framerate).
    
    Returns: (numerator, denominator) tuple
    """
    # Check for explicit numerator/denominator first (new format)
    if 'framerateNumerator' in outputCfg:
        numerator = outputCfg['framerateNumerator']
        denominator = outputCfg.get('framerateDenominator', 1)
    elif 'framerateNumerator' in commonCfg:
        numerator = commonCfg['framerateNumerator']
        denominator = commonCfg.get('framerateDenominator', 1)
    # Fall back to old format (integer framerate)
    elif 'framerate' in outputCfg:
        numerator = int(outputCfg['framerate'] * 1000)
        denominator = 1000
    elif 'framerate' in commonCfg:
        numerator = int(commonCfg['framerate'] * 1000)
        denominator = 1000
    else:
        raise Exception('No framerate specified in config (use framerate or framerateNumerator/framerateDenominator)')
    
    return numerator, denominator

def getH264VideoDescription( outputCfg, commonCfg ):

    gopSize = outputCfg['gopSize'] if 'gopSize' in outputCfg else commonCfg['gopSize']
    codecProfile = outputCfg['codecProfile'] if 'codecProfile' in outputCfg else commonCfg['videoCodecProfile']
    framerateNumerator, framerateDenominator = getFramerateSettings(outputCfg, commonCfg)

    return {
        "Width": outputCfg['width'],
        "Height": outputCfg['height'],
        "CodecSettings": {
            "Codec": "H_264",
            "H264Settings": {
                "ParNumerator": 1,
                "NumberReferenceFrames": 3,
                "FramerateDenominator": framerateDenominator,
                "GopClosedCadence": 1,
                "GopSize": gopSize,
                # Setting NumberBFramesBetweenReferenceFrames to 2 is recommended by MediaTailor/MediaConvert teams
                # to minimize audio buildup during ad stitching. Using 0 B-frames results in more extra audio being
                # created due to timestamp offset calculations, which causes buffering issues after many ads.
                # Value of 2 matches typical live stream configurations and provides less audio overage.
                "GopBReference": "ENABLED",
                "MaxBitrate": outputCfg['maxBitrate'],
                "ParDenominator": 1,
                "FramerateControl": "SPECIFIED",
                "RateControlMode": "QVBR",
                "CodecProfile": codecProfile,
                "FramerateNumerator": framerateNumerator,
                "MinIInterval": 0,
                "AdaptiveQuantization": "AUTO",
                "CodecLevel": "AUTO",
                "GopSizeUnits": commonCfg['gopSizeUnits'],
                "ParControl": "SPECIFIED",
                "NumberBFramesBetweenReferenceFrames": 2,
                "DynamicSubGop": "ADAPTIVE"
            }
        },
        "ColorMetadata": "IGNORE"
    }

def getH265VideoDescription( outputCfg, commonCfg ):

    gopSize = outputCfg['gopSize'] if 'gopSize' in outputCfg else commonCfg['gopSize']
    codecProfile = outputCfg['codecProfile'] if 'codecProfile' in outputCfg else commonCfg['videoCodecProfile']
    framerateNumerator, framerateDenominator = getFramerateSettings(outputCfg, commonCfg)

    # Check for a videoCodecProfileTier override
    videoCodecTier = getVideoCodecProfileTier( outputCfg, commonCfg )

    return {
        "Width": outputCfg['width'],
        "Height": outputCfg['height'],
        "VideoPreprocessors": {
            "TimecodeBurnin": {}
        },
        "CodecSettings": {
            "Codec": "H_265",
            "H265Settings": {
                "FramerateDenominator": framerateDenominator,
                "FramerateControl": "SPECIFIED",
                "FramerateNumerator": framerateNumerator,
                "GopSize": gopSize,
                "MaxBitrate": outputCfg['maxBitrate'],
                "RateControlMode": "QVBR",
                "CodecProfile": codecProfile + '_' + videoCodecTier,
                "SceneChangeDetect": "TRANSITION_DETECTION",
                "GopSizeUnits": commonCfg['gopSizeUnits'],
                # Setting NumberBFramesBetweenReferenceFrames to 2 is recommended by MediaTailor/MediaConvert teams
                # to minimize audio buildup during ad stitching. Using 0 B-frames results in more extra audio being
                # created due to timestamp offset calculations, which causes buffering issues after many ads.
                # Value of 2 matches typical live stream configurations and provides less audio overage.
                "NumberBFramesBetweenReferenceFrames": 2,
                "GopBReference": "ENABLED"
            }
        }
    }

def getImageBaseTrickPlay( config ):

    # Check if config contains image based trick play settings
    # and return if they exist, otherwise return None
    if 'imageBasedTrickPlay' not in config.keys():
        return None
    
    trickplay = config['imageBasedTrickPlay']

    return {
        "ThumbnailHeight": trickplay["thumbnailHeight"],
        "ThumbnailWidth": trickplay["thumbnailWidth"],
        "TileHeight": trickplay["tileHeight"] if "tileWidth" in trickplay.keys() else 1,
        "TileWidth": trickplay["tileWidth"] if "tileWidth" in trickplay.keys() else 1,
        "IntervalCadence": trickplay["intervalCadence"] if "intervalCadence" in trickplay.keys() else "FOLLOW_IFRAME"
    }

def getVideoCodecProfileTier( outputCfg, commonCfg ):

    videoCodecTier = ""
    if outputCfg['codec'] == 'H_265':
        if 'tier' in outputCfg:
            videoCodecTier = outputCfg['tier']
        elif 'videoCodecTier' in commonCfg:
            videoCodecTier = commonCfg['videoCodecTier']
        else:
            raise Exception('Unable to find a specified video codec tier.')
    
    return videoCodecTier

def getInputs( includeCaptionsSelector ):

    input = {
        "AudioSelectors": {
            "Audio Selector 1": {
                "DefaultSelection": "DEFAULT",
            }
        },
        "VideoSelector": {
        },
        "TimecodeSource": "ZEROBASED",
        "FileInput": "s3://bucket/test.mp4",
        "CaptionSelectors": {
           "CaptionSelectors": {
               "Captions Selector 1": {
                   "SourceSettings": {
                       "SourceType": "SCC",
                       "FileSourceSettings": {
                           "SourceFile": "https://d16u1r18na8709.cloudfront.net/clearcaptions.scc"
                       }
                   }
               }
           }
        }
    }
    if not includeCaptionsSelector and "CaptionSelectors" in input.keys():
        del input["CaptionSelectors"]

    return [ input ]

def getTimecodeConfig():
    return {
        "Source": "ZEROBASED"
    }

def get_filename_without_ext(config_file_path):
    # Get the base name of the file (removes the path)
    base_name = os.path.basename(config_file_path)

    # Split the base name to separate the filename and extension
    filename, ext = os.path.splitext(base_name)

    return filename

def formatLanguageCodeToRfc5646(language_code):
    """Format and validate a language code to RFC5646 format.
    
    Args:
        language_code: A language code to validate
    Returns:
        A validated RFC5646 language code
    Raises:
        ValueError: If the language code is not a valid RFC5646 code
    """
    if not language_code:
        raise ValueError("Language code must be defined")

    try:
        
        # Attempt to parse the language tag
        tag = tags.tag(language_code)
        
        # Check if the tag is valid according to RFC 5646
        if not tag.valid:
            raise ValueError(f"'{language_code}' is not a valid RFC 5646 language code")

        return str(tag).lower()
        
    except ImportError:
        raise ImportError("language-tags package is required for RFC 5646 validation. Please install: pip install language-tags")

def formatLanguageCodeToCapitalizedIso639_2(language_code):
    """
    Format and validate a language code to ISO 639-2 uppercase format.
    
    Args:
        language_code (str): The language code to format (can be RFC 5646 or ISO 639-2)
    
    Returns:
        str: The language code in uppercase ISO 639-2 format
        
    Raises:
        ValueError: If language_code is None, empty, or cannot be converted to ISO 639-2
    """
    if not language_code:
        raise ValueError("Language code must be defined")
    
    try:
        # Parse the input language code
        lang = langcodes.Language.get(language_code)
        # Convert to ISO 639-2 and uppercase
        iso_code = lang.to_alpha3().upper()
        return iso_code
    except (ImportError, ValueError) as e:
        if isinstance(e, ImportError):
            raise ImportError("langcodes library is required for language code conversion") from e
        raise ValueError(f"'{language_code}' cannot be converted to ISO 639-2") from e


def getTimecodeBurninFontSize(vertical_resolution):
    """
    Determine the appropriate font size for a burnt-in timecode based on the video's vertical resolution.

    This function takes the vertical resolution of a video as input and returns the corresponding font size
    for the burnt-in timecode. The font size is chosen to ensure that the timecode is not too small or too
    large for the given resolution.

    Args:
        vertical_resolution (int): The vertical resolution of the video in pixels.

    Returns:
        str: The font size for the burnt-in timecode, represented as a string.

    Font Size Mapping:
        - For vertical resolutions <= 270 pixels, the font size is 'EXTRA_SMALL_10'.
        - For vertical resolutions <= 360 pixels, the font size is 'SMALL_16'.
        - For vertical resolutions <= 720 pixels, the font size is 'MEDIUM_32'.
        - For vertical resolutions > 720 pixels, the font size is 'LARGE_48'.

    Example:
        >>> getTimecodeBurninFontSize(480)
        'SMALL_16'
        >>> getTimecodeBurninFontSize(1080)
        'LARGE_48'
    """

    # Set the font size for the burnt in timecode base on vertical
    # resolution so the timecode is not too small or large
    font_size = 'LARGE_48'
    if vertical_resolution <= 270:
        font_size = 'EXTRA_SMALL_10'
    elif vertical_resolution <= 360:
        font_size = 'SMALL_16'
    elif vertical_resolution <= 720:
        font_size = 'MEDIUM_32'

    return font_size


def getMediaLiveMediaPackageOutputGroups( outputs ):

    outputList = []
    # Set outputs for output group
    for output in outputs:
        if output['codec'] in VIDEO_CODECS:
            outputList.append({
                "captionDescriptionNames": [],
                "outputName": f"{output['name']}",
                "outputSettings": {
                    "mediaPackageOutputSettings": {}
                },
                "videoDescriptionName": f"{output['name']}"
            })
        elif output['codec'] in AUDIO_CODECS:
            audioDescriptionName = generateAudioDescriptionName( output['codec'], output['bitrate'], output['languageCode'] )
            outputList.append({
                "outputName": f"{output['name']}",
                "captionDescriptionNames": [],
                "outputSettings": {
                    "mediaPackageOutputSettings": {}
                },
                "audioDescriptionNames": [audioDescriptionName]
            })
        elif output['codec'] in CAPTION_CODECS:
            captionDescriptionName = generateCaptionsDescriptionName(output['languageCode'])
            outputList.append({
                "outputName": f"{output['name']}",
                "outputSettings": {
                    "mediaPackageOutputSettings": {}
                },
                "captionDescriptionNames": [captionDescriptionName]
            })
        else:
            print(f"Unsupported codec: {output['codec']}")
            sys.exit(1)

    outputGroups = [
        {
            "outputGroupSettings": {
                "mediaPackageGroupSettings": {
                    "destination": {
                        "destinationRefId": "media-destination"
                    }
                }
            },
            "name": "MediaPackage",
            "outputs": outputList
        }
    ]

    return outputGroups


def generateMediaLiveMediaPackageProfile( config ):

    outputsConfiguration = config['outputs']
    audioDescriptions = getMediaLiveAudioDescriptions( outputsConfiguration, 'MEDIAPACKAGE' )
    captionDescriptions = getMediaLiveCaptionDescriptions(outputsConfiguration, 'MEDIAPACKAGE')
    globalConfiguration = getMediaLiveGlobalConfiguration()
    videoDescriptions = getMediaLiveVideoDescriptions( outputsConfiguration, config['common'] )

    outputGroups = getMediaLiveMediaPackageOutputGroups( outputsConfiguration )

    profileOutput = OrderedDict()
    profileOutput['audioDescriptions'] = audioDescriptions
    profileOutput['captionDescriptions'] = captionDescriptions
    profileOutput['globalConfiguration'] = globalConfiguration
    profileOutput['outputGroups'] = outputGroups
    profileOutput['timecodeConfig'] = { "source": "SYSTEMCLOCK" }
    profileOutput['videoDescriptions'] = videoDescriptions
    profileOutput['availConfiguration'] = availConfig
    profileOutput['blackoutSlate'] = blackoutSlateConfig

    # write profile to a pretty format json string and maintain the order in the output
    profileOutputDump = json.dumps(profileOutput, indent=2, sort_keys=False)

    return profileOutputDump


if __name__ == "__main__":
    main(sys.argv[1:])
