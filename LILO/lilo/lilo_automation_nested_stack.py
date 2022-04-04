# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

# author:       Emmanuel Etheve
# email:        ethevee@amazon.com
# description:  This is file hold the code to deploy eventbridge triggers as well as lambda functions used for the
#               automation of the LILO application
# created:      31/05/2021 (dd/mm/yyyy)
# modified:     04/04/2022 (dd/mm/yyyy)
# filename:     lilo_automation_nested_stack.py

from constructs import Construct
from aws_cdk import (
    NestedStack,
    Duration,
    aws_iam as iam,
    aws_lambda as _lambda,
    aws_events as events,
    aws_events_targets as targets,
)

class lilo_automation_nested_stack(NestedStack):

    def __init__(
            self,
            scope: Construct,
            construct_id: str,
            role: iam.Role,
            auto_start: bool,
            stack_name: str,
            **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        if auto_start:
            # Lambda configuration definitions
            self.medialive_channel_start_function = _lambda.Function(
                self, f"{stack_name}_medialive_channel_start_function",
                runtime=_lambda.Runtime.PYTHON_3_8,
                # code=_lambda.Code.asset('lilo/lambda'),
                code=_lambda.Code.from_asset('lilo/lambda'),
                handler='medialive_channel_start_function.medialive_channel_start_function',
                role=role,
                function_name=f"{stack_name}_medialive_channel_start_function",
                timeout=Duration.seconds(125),
            )

            # EventBridge rule definition
            self.event_medialive_channel_start = events.Rule(
                self,
                id=f"{stack_name}_event_medialive_channel_start",
                rule_name=f"{stack_name}_event_medialive_channel_start",
                enabled=True,
                event_pattern=events.EventPattern(
                        source=[
                            "aws.medialive"
                        ],
                        detail_type=[
                            "MediaLive Channel State Change"
                        ]
                ),
            )
            self.event_medialive_channel_start.add_target(targets.LambdaFunction(self.medialive_channel_start_function))
