# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

# author:       Emmanuel Etheve
# email:        ethevee@amazon.com
# description:  This is file hold the code of the core stack to deploy shared ressources between the stack that
#               can also be used by other services
# created:      17/05/2021 (dd/mm/yyyy)
# modified:     04/04/2022 (dd/mm/yyyy)
# filename:     lilo.py

from constructs import Construct
from aws_cdk import (
    Stack,
    NestedStack,
    aws_medialive as eml,
    aws_iam as iam,
)
from lilo.medialive_nested_stack import medialive_nested_stack
class LiloStack(Stack):

    def __init__(
            self,
            scope: Construct,
            construct_id: str,
            **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

    def set_output(
            self,
            medialive: medialive_nested_stack,
    ):
        self.channel_id = cdk.CfnOutput(
            self,
            'ChannnelId',
            value=medialive.my_eml_tx_channel.ref,
        )
