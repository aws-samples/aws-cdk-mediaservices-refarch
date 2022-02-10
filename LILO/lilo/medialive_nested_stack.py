# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

# author:       Emmanuel Etheve
# email:        ethevee@amazon.com
# description:  This is file hold the code to deploy the media infrasctructure required for the LILO application
# created:      31/05/2021 (dd/mm/yyyy)
# modified:     30/08/2021 (dd/mm/yyyy)
# filename:     medialive_nested_stack.py

from aws_cdk import (
    core as cdk,
    aws_medialive as eml,
    aws_iam as iam,
)
class medialive_nested_stack(cdk.NestedStack):

    @property
    def get_channel_id(self):
        return self.channel_id

    def __init__(
            self,
            scope: cdk.Construct,
            construct_id: str,
            source: str,
            destination: str,
            port: int,
            role: iam.CfnRole,
            stack_name: str,
            **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        input_name = "lilo_input"
        channel_name = "lilo_channel"
        output_id = "app-rtp-output"
        # MediaLive input definition
        lilo_input = eml.CfnInput(
            self,
            input_name,
            input_security_groups=["0.0.0.0/0"],
            name=input_name,
            role_arn=role.attr_arn,
            sources=[
                eml.CfnInput.InputSourceRequestProperty(
                    url=source
                )
            ],
            type="MP4_FILE",
        )

        # Medialive channel definition
        self.my_eml_tx_channel = eml.CfnChannel(
            self,
            channel_name,
            channel_class="SINGLE_PIPELINE",
            log_level="DEBUG",
            name=channel_name,
            role_arn=role.attr_arn,
            input_specification=eml.CfnChannel.InputSpecificationProperty(
                codec="AVC",
                maximum_bitrate="MAX_10_MBPS",
                resolution="HD",
            ),
            input_attachments=[
                eml.CfnChannel.InputAttachmentProperty(
                    input_id=lilo_input.ref,
                    input_attachment_name=lilo_input.name,
                    input_settings=eml.CfnChannel.InputSettingsProperty(
                        source_end_behavior="LOOP",
                        input_filter="AUTO",
                        filter_strength=1,
                        deblock_filter="DISABLED",
                        denoise_filter="DISABLED",
                        smpte2038_data_preference="IGNORE",
                        audio_selectors=[],
                        caption_selectors=[],
                    )
                )
            ],
            encoder_settings=eml.CfnChannel.EncoderSettingsProperty(
                audio_descriptions=[
                    eml.CfnChannel.AudioDescriptionProperty(
                        name="audio_hh29n",
                        audio_selector_name="fr",
                        audio_type_control="FOLLOW_INPUT",
                        language_code_control="USE_CONFIGURED",
                        language_code="fr",
                        stream_name="Francais",
                        codec_settings=eml.CfnChannel.AudioCodecSettingsProperty(
                            aac_settings=eml.CfnChannel.AacSettingsProperty(
                                input_type="NORMAL",
                                bitrate=96000,
                                coding_mode="CODING_MODE_2_0",
                                raw_format="NONE",
                                spec="MPEG4",
                                profile="LC",
                                rate_control_mode="CBR",
                                sample_rate=48000,
                            )
                        )
                    ),
                ],
                output_groups=[
                    eml.CfnChannel.OutputGroupProperty(
                        name="RtpStream",
                        output_group_settings=eml.CfnChannel.OutputGroupSettingsProperty(
                            udp_group_settings=eml.CfnChannel.UdpGroupSettingsProperty(

                            ),
                        ),
                        outputs=[
                            eml.CfnChannel.OutputProperty(
                                output_settings=eml.CfnChannel.OutputSettingsProperty(
                                    udp_output_settings=eml.CfnChannel.UdpOutputSettingsProperty(
                                        destination=eml.CfnChannel.OutputLocationRefProperty(
                                            destination_ref_id=output_id
                                        ),
                                        container_settings=eml.CfnChannel.UdpContainerSettingsProperty(
                                            m2_ts_settings=eml.CfnChannel.M2tsSettingsProperty()
                                        )
                                    ),
                                ),
                                output_name="video_1080p",
                                video_description_name="video_8o4zbm",
                                audio_description_names=["audio_hh29n"],
                            ),
                        ]
                    )
                ],
                timecode_config=eml.CfnChannel.TimecodeConfigProperty(
                    source="SYSTEMCLOCK",
                ),
                video_descriptions=[
                    eml.CfnChannel.VideoDescriptionProperty(
                        name="video_8o4zbm",
                        height=1080,
                        width=1920,
                        respond_to_afd="NONE",
                        sharpness=50,
                        scaling_behavior="DEFAULT",
                        codec_settings=eml.CfnChannel.VideoCodecSettingsProperty(
                            h264_settings=eml.CfnChannel.H264SettingsProperty(
                                afd_signaling="NONE",
                                color_metadata="INSERT",
                                adaptive_quantization="MEDIUM",
                                bitrate=10000000,
                                entropy_encoding="CAVLC",
                                flicker_aq="ENABLED",
                                force_field_pictures="DISABLED",
                                framerate_control="SPECIFIED",
                                framerate_numerator=25,
                                framerate_denominator=1,
                                gop_b_reference="DISABLED",
                                gop_closed_cadence=1,
                                gop_num_b_frames=2,
                                gop_size=50,
                                gop_size_units="FRAMES",
                                subgop_length="FIXED",
                                scan_type="PROGRESSIVE",
                                level="H264_LEVEL_AUTO",
                                look_ahead_rate_control="MEDIUM",
                                num_ref_frames=1,
                                par_control="SPECIFIED",
                                profile="MAIN",
                                rate_control_mode="CBR",
                                syntax="DEFAULT",
                                scene_change_detect="ENABLED",
                                spatial_aq="ENABLED",
                                temporal_aq="ENABLED",
                                timecode_insertion="DISABLED",
                            )
                        )
                    ),
                ]
            ),
            destinations=[
                eml.CfnChannel.OutputDestinationProperty(
                    id=output_id,
                    settings=[
                        eml.CfnChannel.OutputDestinationSettingsProperty(
                            url=f"rtp://{destination}:{port}"
                        )
                    ]
                ),
            ],
            tags={"StackName":stack_name}
        )
        self.my_eml_tx_channel.add_depends_on(lilo_input)
