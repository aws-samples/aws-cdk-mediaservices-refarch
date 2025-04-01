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
    'mediatailor-dash',
    'medialive-hls-ts',
    'medialive-cmaf-ingest'
]

default_output_path = "generated-profiles"

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
        if output_type in ['mediatailor-hls-cmaf', 'mediatailor-dash']:

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
    audioDescriptions = getMediaLiveAudioDescriptions( outputsConfiguration )
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
    profileOutput['availConfiguration'] = {
        "availSettings": {
            "scte35SpliceInsert": {
                "webDeliveryAllowedFlag": "FOLLOW",
                "noRegionalBlackoutFlag": "FOLLOW"
            }
        }
    }

    # write ctp to a pretty format json string and maintain the order in the output
    profileOutputDump = json.dumps(profileOutput, indent=2, sort_keys=False)

    return profileOutputDump

def generateMediaLiveCmafIngestProfile( config ):

    outputsConfiguration = config['outputs']

    # MediaLive CMAF Ingest Output Groups do not currently support FRAME_CAPTURE
    # outputs.
    # These outputs will automatically be removed from the profile.
    unique_codecs = set( output['codec'] for output in outputsConfiguration )
    if 'FRAME_CAPTURE' in unique_codecs:
        print("Skipping FRAME_CAPTURE rendition in CMAF encoding profile.")
        print("MediaLive CMAF Ingest Output Group does not currently support FRAME_CAPTURE renditions.")

        # Remove any frame capture outputs
        outputsConfiguration = [ output for output in outputsConfiguration if output['codec'] != 'FRAME_CAPTURE' ]

    audioDescriptions = getMediaLiveAudioDescriptions( outputsConfiguration )
    captionDescriptions = getMediaLiveCaptionDescriptions(outputsConfiguration, 'CMAF-INGEST')
    globalConfiguration = getMediaLiveGlobalConfiguration()
    videoDescriptions = getMediaLiveVideoDescriptions( outputsConfiguration, config['common'] )

    # Set the first audio rendition to be the default rendition.
    # This will set add 'MAIN' to the 'audioDashRoles'
    if len(audioDescriptions) > 0:
        if 'audioDashRoles' not in audioDescriptions[0].keys():
            audioDescriptions[0]['audioDashRoles'] = []
        
        # Check audioDescriptions[0]['audioDashRoles'] list does
        # not already have 'MAIN' entry
        if 'MAIN' not in audioDescriptions[0]['audioDashRoles']:
            audioDescriptions[0]['audioDashRoles'].append('MAIN')

    outputGroups = getMediaLiveCmafIngestOutputGroups( outputsConfiguration, config['common'] )

    profileOutput = OrderedDict()
    profileOutput['audioDescriptions'] = audioDescriptions
    profileOutput['captionDescriptions'] = captionDescriptions
    profileOutput['globalConfiguration'] = globalConfiguration
    profileOutput['outputGroups'] = outputGroups
    profileOutput['timecodeConfig'] = { "source": "SYSTEMCLOCK" }
    profileOutput['videoDescriptions'] = videoDescriptions
    profileOutput['availConfiguration'] = {
        "availSettings": {
            "scte35SpliceInsert": {
                "webDeliveryAllowedFlag": "FOLLOW",
                "noRegionalBlackoutFlag": "FOLLOW"
            }
        }
    }

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

def getMediaLiveVideoDescriptions( outputs, commonConfig ):

    videoDescriptions = []

    # Configure video descriptions
    for output in outputs:
        if output['codec'] not in VIDEO_CODECS:
            continue

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

        # Check for a framerate override
        framerate = ""
        if 'framerate' in output:
            framerate = output['framerate']
        elif 'framerate' in commonConfig:
            framerate = commonConfig['framerate']
        else:
            raise Exception('Unable to find a specified framerate.')

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

        videoDescription = {}
        if output['codec'] == 'H_264':
            videoDescription = {
                "codecSettings": {
                    "h264Settings": {
                        "afdSignaling": "NONE",
                        "colorMetadata": "INSERT",
                        "adaptiveQuantization": "AUTO",
                        "entropyEncoding": "CABAC",
                        "flickerAq": "ENABLED",
                        "framerateControl": "SPECIFIED",
                        "framerateNumerator": framerate,
                        "framerateDenominator": 1,
                        "gopBReference": "ENABLED",
                        "gopClosedCadence": 1,
                        "gopNumBFrames": 3,
                        "gopSize": gopSize,
                        "gopSizeUnits": commonConfig['gopSizeUnits'],
                        "subgopLength": "DYNAMIC",
                        "scanType": "PROGRESSIVE",
                        "level": "H264_LEVEL_AUTO",
                        "lookAheadRateControl": videoLookAheadRateControl,
                        "maxBitrate": output['maxBitrate'],
                        "numRefFrames": 3,
                        "parControl": "SPECIFIED",
                        "parDenominator": 1,
                        "parNumerator": 1,
                        "profile": videoCodecProfile,
                        "rateControlMode": "QVBR",
                        "syntax": "DEFAULT",
                        "sceneChangeDetect": "ENABLED",
                        "spatialAq": "ENABLED",
                        "temporalAq": "ENABLED",
                        "timecodeBurninSettings": {
                            "fontSize": getTimecodeBurninFontSize( output['height'] ),
                            "position": "TOP_LEFT",
                            "prefix": ""
                        },
                        "timecodeInsertion": "DISABLED"
                    }
                },
                "height": output['height'],
                "name": f"{output['name']}",
                "respondToAfd": "NONE",
                "sharpness": 100,
                "scalingBehavior": "DEFAULT",
                "width": output['width']
            }

            # Set the buffer size if it has been defined
            if bufSize:
                videoDescription['codecSettings']['h264Settings']['bufSize'] = output['bufSize']

        elif output['codec'] == 'H_265':
            videoDescription = {
                "codecSettings": {
                    "h265Settings": {
                        "adaptiveQuantization": "AUTO",
                        "afdSignaling": "NONE",
                        "alternativeTransferFunction": "OMIT",
                        "colorMetadata": "INSERT",
                        "flickerAq": "ENABLED",
                        "framerateDenominator": 1,
                        "framerateNumerator": framerate,
                        "gopClosedCadence": 1,
                        "gopSize": gopSize,
                        "gopSizeUnits": "FRAMES",
                        "level": "H265_LEVEL_AUTO",
                        "lookAheadRateControl": videoLookAheadRateControl,
                        "maxBitrate": output['maxBitrate'],
                        "mvOverPictureBoundaries": "ENABLED",
                        "mvTemporalPredictor": "ENABLED",
                        "parDenominator": 1,
                        "parNumerator": 1,
                        "profile": videoCodecProfile,
                        "rateControlMode": "QVBR",
                        "scanType": "PROGRESSIVE",
                        "sceneChangeDetect": "ENABLED",
                        "tier": videoCodecTier,
                        "tilePadding": "NONE",
                        "timecodeBurninSettings": {
                            "fontSize": getTimecodeBurninFontSize( output['height'] ),
                            "position": "TOP_LEFT"
                        },
                        "timecodeInsertion": "DISABLED",
                        "treeblockSize": "AUTO"
                    }
                },
                "height": output['height'],
                "name": f"{output['name']}",
                "respondToAfd": "NONE",
                "sharpness": 100,
                "scalingBehavior": "DEFAULT",
                "width": output['width']
            }

            # Set the buffer size if it has been defined
            if bufSize:
                videoDescription['codecSettings']['h265Settings']['bufSize'] = output['bufSize']

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
    return f"audio_{codec.lower().replace('-', '')}_{bitrate}_{language}"

def generateCaptionsDescriptionName(language):
    return f"captions_{language}"

def getMediaLiveAudioDescriptions( outputs ):

    audioDescriptions = []

    # Configure audio descriptions
    for output in outputs:
        if output['codec'] not in AUDIO_CODECS:
            continue

        audioDescription = {}
        languageCode = formatLanguageCode(output['languageCode'])
        audioDescriptionName = generateAudioDescriptionName( output['codec'], output['bitrate'], output['languageCode'] )

        if output['codec'] == 'AAC':
            audioDescription = {
                "codecSettings": {
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
                "audioTypeControl": "FOLLOW_INPUT",
                "languageCode": languageCode,
                "languageCodeControl": "USE_CONFIGURED",
                "auldioSelectorName": "default",
                "name": audioDescriptionName,
                "streamName": output['streamName']
            }
        elif output['codec'] == 'AC3':
            audioDescription = {
                "codecSettings": {
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
                "audioTypeControl": "FOLLOW_INPUT",
                "languageCode": languageCode,
                "languageCodeControl": "USE_CONFIGURED",
                "auldioSelectorName": "default",
                "name": audioDescriptionName,
                "streamName": output['streamName']
            }
        elif output['codec'] == 'EAC3':
            audioDescription = {
                "audioSelectorName": "default",
                "audioTypeControl": "FOLLOW_INPUT",
                "codecSettings": {
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
                },
                "languageCode": languageCode,
                "languageCodeControl": "USE_CONFIGURED",
                "name": audioDescriptionName,
                "streamName": output['streamName']
            }
        else:
            print("Unsupported audio codec: " + output['codec'])
            sys.exit(1)

        audioDescriptions.append(audioDescription)

    return audioDescriptions

def getMediaLiveCaptionDescriptions( outputs, outputGroupType ):

    # Check outputGroupType
    SUPPORTED_OUTPUTGROUP_TYPES=['HLS-TS','CMAF-INGEST']
    if outputGroupType not in SUPPORTED_OUTPUTGROUP_TYPES:
        # create a string concatenating all values of SUPPORTED_OUTPUTGROUP_TYPES separated by '|'
        supportedOutputGroupTypesString = ' | '.join(SUPPORTED_OUTPUTGROUP_TYPES)
        raise Exception('Invalid outputGroupType [%s]. Supported Types: %s' % ( outputGroupType, supportedOutputGroupTypesString ))        

    captionsDescriptions = []

    # Configure caption descriptions
    for output in outputs:
        if output['codec'] not in CAPTION_CODECS:
            continue

        captionsDescription = {}
        languageCode = formatLanguageCode(output['languageCode'])
        captionsDescriptionName = generateCaptionsDescriptionName( output['languageCode'] )

        if outputGroupType == 'CMAF-INGEST':
            captionsDescription = {
                "name": captionsDescriptionName,
                "languageCode": languageCode,
                "languageDescription": output['languageDescription'],
                "accessibility": output['accessibility'],
                "captionDashRoles": [
                    "MAIN"
                ],
                "captionSelectorName": output['captionsSelectorName'],
                "destinationSettings": {
                    "ttmlDestinationSettings": {
                        "styleControl": output['styleControl']
                    }
                },
            }

        elif outputGroupType == 'HLS-TS':
            captionsDescription = {
                "name": captionsDescriptionName,
                "languageCode": languageCode,
                "languageDescription": output['languageDescription'],
                "captionSelectorName": output['captionsSelectorName'],
                "destinationSettings": {
                    "webvttDestinationSettings": {}
                },
            }

        else:
            print("Unsupported captions codec: " + output['codec'])
            sys.exit(1)
        
        captionsDescriptions.append(captionsDescription)

    return captionsDescriptions

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
            "Container": "CMFC",
            "CmfcSettings": {
                "AudioDuration": "MATCH_VIDEO_DURATION"
            }
        }
        audioContainerSettings = videoContainerSettings
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
                        "LanguageCode": outputCfg['languageCode'] if 'languageCode' in outputCfg.keys() else ""
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
                        "LanguageCode": outputCfg['languageCode'] if 'languageCode' in outputCfg.keys() else ""
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
                        "LanguageCode": outputCfg['languageCode'] if 'languageCode' in outputCfg.keys() else ""
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
                        "LanguageCode": outputCfg["languageCode"]
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
    else:
        outputGroup = getDashOutputGroup(outputGroup, outputs, config)

    ctpOutputFile = OrderedDict()
    ctpOutputFile["TimecodeConfig"] = timecodeConfig
    ctpOutputFile["OutputGroups"] = [ outputGroup ]
    ctpOutputFile[ "AdAvailOffset"] = adAvailOffset
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

def getCmafOutputGroup( outputGroup, outputs, config ):

    commonCfg = config["common"]

    outputGroup["Name"] = "CMAF"
    outputGroup["Outputs"] = outputs
    outputGroup["OutputGroupSettings"] = {
        "Type": "CMAF_GROUP_SETTINGS",
        "CmafGroupSettings": {
            "WriteHlsManifest": "ENABLED",
            "WriteDashManifest": "ENABLED",
            "SegmentLength": commonCfg["segmentLength"],
            "SegmentLengthControl": "GOP_MULTIPLE",
            "MinFinalSegmentLength": 1,
            "Destination": "s3://bucket/main",
            "FragmentLength": commonCfg["fragmentLength"],
            "SegmentControl": "SEGMENTED_FILES",
            "MpdProfile": "MAIN_PROFILE",
            "ManifestDurationFormat": "FLOATING_POINT",
            "StreamInfResolution": "INCLUDE",
            "ClientCache": "ENABLED",
            "ManifestCompression": "NONE",
            "CodecSpecification": "RFC_4281"
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

def getH264VideoDescription( outputCfg, commonCfg ):

    gopSize = outputCfg['gopSize'] if 'gopSize' in outputCfg else commonCfg['gopSize']
    codecProfile = outputCfg['codecProfile'] if 'codecProfile' in outputCfg else commonCfg['videoCodecProfile']
    framerate = outputCfg['framerate'] if 'framerate' in outputCfg else commonCfg['framerate']

    return {
        "Width": outputCfg['width'],
        "ScalingBehavior": "DEFAULT",
        "Height": outputCfg['height'],
        "VideoPreprocessors": {
            "Deinterlacer": {}
        },
        "TimecodeInsertion": "DISABLED",
        "AntiAlias": "ENABLED",
        "Sharpness": 50,
        "CodecSettings": {
        "Codec": "H_264",
        "H264Settings": {
            "InterlaceMode": "PROGRESSIVE",
            "ParNumerator": 1,
            "NumberReferenceFrames": 3,
            "Syntax": "DEFAULT",
            "Softness": 0,
            "FramerateDenominator": 1,
            "GopClosedCadence": 1,
            "GopSize": gopSize,
            "Slices": 1,
            "GopBReference": "ENABLED",
            "MaxBitrate": outputCfg['maxBitrate'],
            "SlowPal": "DISABLED",
            "ParDenominator": 1,
            "EntropyEncoding": "CABAC",
            "FramerateControl": "SPECIFIED",
            "RateControlMode": "QVBR",
            "CodecProfile": codecProfile,
            "FramerateNumerator": framerate,
            "MinIInterval": 0,
            "AdaptiveQuantization": "AUTO",
            "CodecLevel": "AUTO",
            "FieldEncoding": "PAFF",
            "SceneChangeDetect": "DISABLED",
            "QualityTuningLevel": "SINGLE_PASS",
            "FramerateConversionAlgorithm": "DUPLICATE_DROP",
            "UnregisteredSeiTimecode": "DISABLED",
            "GopSizeUnits": commonCfg['gopSizeUnits'],
            "ParControl": "SPECIFIED",
            "NumberBFramesBetweenReferenceFrames": 3,
            "RepeatPps": "DISABLED",
            "DynamicSubGop": "ADAPTIVE"
        }
        },
        "AfdSignaling": "NONE",
        "DropFrameTimecode": "ENABLED",
        "RespondToAfd": "NONE",
        "ColorMetadata": "IGNORE"
    }

def getH265VideoDescription( outputCfg, commonCfg ):

    gopSize = outputCfg['gopSize'] if 'gopSize' in outputCfg else commonCfg['gopSize']
    codecProfile = outputCfg['codecProfile'] if 'codecProfile' in outputCfg else commonCfg['videoCodecProfile']
    framerate = outputCfg['framerate'] if 'framerate' in outputCfg else commonCfg['framerate']

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
                "FramerateDenominator": 1,
                "FramerateControl": "SPECIFIED",
                "FramerateNumerator": framerate,
                "GopSize": gopSize,
                "MaxBitrate": outputCfg['maxBitrate'],
                "RateControlMode": "QVBR",
                "CodecProfile": codecProfile + '_' + videoCodecTier,
                "SceneChangeDetect": "TRANSITION_DETECTION",
                "GopSizeUnits": commonCfg['gopSizeUnits']
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
            "Offset": 0,
            "DefaultSelection": "DEFAULT",
            "ProgramSelection": 1
            }
        },
        "VideoSelector": {
            "ColorSpace": "FOLLOW",
            "Rotate": "DEGREE_0",
            "AlphaBehavior": "DISCARD"
        },
        "FilterEnable": "AUTO",
        "PsiControl": "USE_PSI",
        "FilterStrength": 0,
        "DeblockFilter": "DISABLED",
        "DenoiseFilter": "DISABLED",
        "TimecodeSource": "EMBEDDED",
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
    if not includeCaptionsSelector:
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

def formatLanguageCode(language_code):
    """
    Format a language code by converting it to lowercase with validation rules.
    
    Args:
        language_code (str): The language code to format (e.g., 'ENG', '123', 'esp')
    
    Returns:
        str: The formatted language code in lowercase
        
    Raises:
        ValueError: If language_code is None, empty, not 3 characters, or contains invalid characters
        
    Examples:
        >>> formatLanguageCode('ENG')
        'eng'
        >>> formatLanguageCode('123')
        '123'
        >>> formatLanguageCode('esp')
        'esp'
        >>> formatLanguageCode('EN')  # Raises ValueError - not 3 characters
        >>> formatLanguageCode('ENG!') # Raises ValueError - invalid characters
        >>> formatLanguageCode(None)  # Raises ValueError - None value
    """
    # Check if language code is defined
    if not language_code:
        raise ValueError("Language code must be defined")
    
    # Check if language code is exactly 3 characters
    if len(language_code) != 3:
        raise ValueError("Language code must be exactly 3 characters")
    
    # Check if language code contains only alphanumeric characters
    if not language_code.isalnum():
        raise ValueError("Language code must contain only letters and numbers")
    
    return language_code.lower()


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


if __name__ == "__main__":
    main(sys.argv[1:])
