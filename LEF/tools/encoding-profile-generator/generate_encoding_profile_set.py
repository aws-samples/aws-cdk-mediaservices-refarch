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

SUPPORTED_CODECS=[
    'H_264',
    'H_265',
    'AAC',
    'AC3',
    'EAC3',
    'FRAME_CAPTURE',
    'STPP'
]

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

OUTPUT_TYPES = [
    'mediatailor-hls-cmaf',
    'mediatailor-dash',
    'medialive-hls-ts'
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

    output_file_prefix = get_filename_without_ext(config_file_path)

    for output_type in OUTPUT_TYPES:
        output_file = f"{output_file_prefix}-{output_type}-v{profile_version}.json"

        if output_type in ['mediatailor-hls-cmaf', 'mediatailor-dash']:

            ctpOutput = createCustomTranscodeProfile( output_type, config )
            write_content_to_file(output_file_path + '/' + output_file, ctpOutput)

            # Reset trickmode settings so multiple ctp can be generated
            ctp_trickmode_settings = None

        elif output_type == "medialive-hls-ts":

            mlOutput = generateMediaLiveProfile( config )
            write_content_to_file(output_file_path + '/' + output_file, mlOutput)

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


def generateMediaLiveProfile( config ):
    print("Generating MediaLive Profile")

    audioDescriptions = []
    captionDescriptions = []
    outputGroups = []
    videoDescriptions = []

    audioDescriptions = getMediaLiveAudioDescriptions( config['outputs'] )
    videoDescriptions = getMediaLiveVideoDescriptions( config['outputs'], config['common'] )
    outputGroups = getMediaLiveOutputGroups( config['outputs'] )

    profileOutput = OrderedDict()
    profileOutput['audioDescriptions'] = audioDescriptions
    profileOutput['captionDescriptions'] = captionDescriptions
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

def getMediaLiveOutputGroups( outputs ):

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
            audioDescriptionName = generateAudioDescriptionName( output['codec'], output['bitrate'] )
            outputList.append({
                "outputName": f"{output['name']}",
                "captionDescriptionNames": [],
                "outputSettings": {
                    "mediaPackageOutputSettings": {}
                },
                "audioDescriptionNames": [audioDescriptionName]
            })
        elif output['codec'] == 'STPP':
            print("TODO: Implement support for STPP")
            continue
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

        # Check for lookAheadRateControl Value
        lookAheadRateControl = "HIGH"
        if 'lookAheadRateControl' in output:
            lookAheadRateControl = output['lookAheadRateControl']

        # Check for lookAheadRateControl Value
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
                        "framerateNumerator": output['framerate'],
                        "framerateDenominator": 1,
                        "gopBReference": "ENABLED",
                        "gopClosedCadence": 1,
                        "gopNumBFrames": 3,
                        "gopSize": gopSize,
                        "gopSizeUnits": commonConfig['gopSizeUnits'],
                        "subgopLength": "DYNAMIC",
                        "scanType": "PROGRESSIVE",
                        "level": "H264_LEVEL_AUTO",
                        "lookAheadRateControl": lookAheadRateControl,
                        "maxBitrate": output['maxBitrate'],
                        "numRefFrames": 3,
                        "parControl": "SPECIFIED",
                        "parDenominator": 1,
                        "parNumerator": 1,
                        "profile": output['codecProfile'],
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
                        "framerateNumerator": output['framerate'],
                        "gopClosedCadence": 1,
                        "gopSize": gopSize,
                        "gopSizeUnits": "FRAMES",
                        "level": "H265_LEVEL_AUTO",
                        "lookAheadRateControl": lookAheadRateControl,
                        "maxBitrate": output['maxBitrate'],
                        "mvOverPictureBoundaries": "ENABLED",
                        "mvTemporalPredictor": "ENABLED",
                        "parDenominator": 1,
                        "parNumerator": 1,
                        "profile": output['codecProfile'],
                        "rateControlMode": "QVBR",
                        "scanType": "PROGRESSIVE",
                        "sceneChangeDetect": "ENABLED",
                        "tier": output['tier'],
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

def generateAudioDescriptionName(codec, bitrate):
    return f"audio_{codec.lower().replace('-', '')}_{bitrate}"

def getMediaLiveAudioDescriptions( outputs ):

    audioDescriptions = []

    # Configure audio descriptions
    for output in outputs:
        if output['codec'] not in AUDIO_CODECS:
            continue

        audioDescription = {}
        twoLetterLanguageCode = convert_language_code(output['languageCode'])
        audioDescriptionName = generateAudioDescriptionName( output['codec'], output['bitrate'] )

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
                "languageCode": twoLetterLanguageCode,
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
                "languageCode": twoLetterLanguageCode,
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
                "languageCode": twoLetterLanguageCode,
                "languageCodeControl": "USE_CONFIGURED",
                "name": audioDescriptionName,
                "streamName": output['streamName']
            }
        else:
            print("Unsupported audio codec: " + output['codec'])
            sys.exit(1)

        audioDescriptions.append(audioDescription)

    return audioDescriptions

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
        
        if outputCfg['codec'] == 'STPP':
            if profileType != "mediatailor-dash":
                print("Skipping track because codec is not supported for %s profiles" % profileType)
                pprint(outputCfg)
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

        elif outputCfg['codec'] == "STPP":
            output = {
                "ContainerSettings": captionsContainerSettings,
                "NameModifier": outputCfg['name'],
                "CaptionDescriptions": [
                    {
                        "CaptionSelectorName": "Captions Selector 1",
                        "DestinationSettings": {
                            "DestinationType": "TTML",
                            "TtmlDestinationSettings": {
                            }
                        },
                        "LanguageCode": outputCfg["LanguageCode"]
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
            "GopSize": commonCfg['gopSize'],
            "Slices": 1,
            "GopBReference": "ENABLED",
            "MaxBitrate": outputCfg['maxBitrate'],
            "SlowPal": "DISABLED",
            "ParDenominator": 1,
            "EntropyEncoding": "CABAC",
            "FramerateControl": "SPECIFIED",
            "RateControlMode": "QVBR",
            "CodecProfile": outputCfg['codecProfile'],
            "FramerateNumerator": outputCfg['framerate'],
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

    return {
        "Width": outputCfg['width'],
        "Height": outputCfg['height'],
        "VideoPreprocessors": {
            "TimecodeBurnin": {}
        },
        "CodecSettings": {
            "Codec": "H_265",
            "H265Settings": {
                "GopSize": commonCfg['gopSize'],
                "MaxBitrate": outputCfg['maxBitrate'],
                "RateControlMode": "QVBR",
                "CodecProfile": outputCfg['codecProfile'] + '_' + outputCfg['tier'],
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

import langcodes

def convert_language_code(three_letter_code):
    """
    Convert a three-letter language code (ISO 639-2) to a two-letter language code (ISO 639-1).

    Args:
        three_letter_code (str): The three-letter language code to be converted.

    Returns:
        str: The corresponding two-letter language code.

    Raises:
        ValueError: If the three-letter code is not recognized or cannot be converted.

    Example:
        >>> convert_language_code("eng")
        'en'
        >>> convert_language_code("fra")
        'fr'
        >>> convert_language_code("invalid_code")
        Traceback (most recent call last):
            ...
        ValueError: Could not find a two-letter code for invalid_code
    """
    try:
        # Convert the three-letter code to a two-letter code using langcodes
        two_letter_code = langcodes.standardize_tag(three_letter_code)
        return two_letter_code
    except langcodes.LanguageCodeError:
        raise ValueError(f"Could not find a two-letter code for {three_letter_code}")

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
