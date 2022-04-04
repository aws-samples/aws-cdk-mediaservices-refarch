# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

# author:       Emmanuel Etheve
# email:        ethevee@amazon.com
# description:  This is file hold the code to deploy the IAM roles and policies required for the application to run
# created:      17/05/2021 (dd/mm/yyyy)
# modified:     04/04/2022 (dd/mm/yyyy)
# filename:     iam_nested_stack.py

from constructs import Construct
from aws_cdk import (
    NestedStack,
    aws_iam as iam,
)

class iam_nested_stack(NestedStack):

    def __init__(
            self,
            scope: Construct,
            construct_id: str,
            stack: str,
            **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        roleName = f"{stack}_MediaLiveAccessRole"
        self.LiloMediaLiveAccessRole = iam.CfnRole(
            self,
            roleName,
            description="AEMS MediaLive access role",
            role_name=roleName,
            assume_role_policy_document=iam.PolicyDocument(
                statements=[
                    iam.PolicyStatement(
                        actions=["sts:AssumeRole"],
                        principals=[
                            iam.ServicePrincipal("medialive.amazonaws.com")
                        ],
                        effect=iam.Effect.ALLOW
                    )
                ],
            ),
            policies=[
                iam.CfnRole.PolicyProperty(
                    policy_name="MediaLiveAccessPolicy",
                    policy_document=iam.PolicyDocument(
                        statements=[
                            iam.PolicyStatement(
                                effect=iam.Effect.ALLOW,
                                resources=['*'],
                                actions=[
                                    "ssm:Describe*",
                                    "ssm:Get*",
                                    "ssm:List*",
                                ]
                            ),
                            iam.PolicyStatement(
                                effect=iam.Effect.ALLOW,
                                resources=['*'],
                                actions=[
                                    "s3:ListBucket",
                                    "s3:PutObject",
                                    "s3:GetObject",
                                    "s3:DeleteObject",
                                ]
                            ),
                            iam.PolicyStatement(
                                effect=iam.Effect.ALLOW,
                                resources=['*'],
                                actions=[
                                    "mediastore:ListContainers",
                                    "mediastore:PutObject",
                                    "mediastore:GetObject",
                                    "mediastore:DeleteObject",
                                    "mediastore:DescribeObject",
                                ]
                            ),
                            iam.PolicyStatement(
                                effect=iam.Effect.ALLOW,
                                resources=['*'],
                                actions=[
                                    "logs:CreateLogGroup",
                                    "logs:CreateLogStream",
                                    "logs:PutLogEvents",
                                    "logs:DescribeLogStreams",
                                    "logs:DescribeLogGroups",
                                ]
                            ),
                            iam.PolicyStatement(
                                effect=iam.Effect.ALLOW,
                                resources=['*'],
                                actions=[
                                    "mediaconnect:ManagedDescribeFlow",
                                    "mediaconnect:ManagedAddOutput",
                                    "mediaconnect:ManagedRemoveOutput",
                                ]
                            ),
                            iam.PolicyStatement(
                                effect=iam.Effect.ALLOW,
                                resources=['*'],
                                actions=[
                                    "ec2:describeSubnets",
                                    "ec2:describeNetworkInterfaces",
                                    "ec2:createNetworkInterface",
                                    "ec2:createNetworkInterfacePermission",
                                    "ec2:deleteNetworkInterface",
                                    "ec2:deleteNetworkInterfacePermission",
                                    "ec2:describeSecurityGroups",
                                ]
                            ),
                            iam.PolicyStatement(
                                effect=iam.Effect.ALLOW,
                                resources=['*'],
                                actions=[
                                    "mediapackage:DescribeChannel",
                                ]
                            ),
                            iam.PolicyStatement(
                                effect=iam.Effect.ALLOW,
                                resources=['*'],
                                actions=[
                                    "kms:*",
                                ]
                            ),
                        ]
                    ),
                )
            ]
        )


        self.aems_automation_role = iam.Role(
            self,
            f"{stack}_aems_automation_role",
            description="AEMS automation role",
            role_name=f"{stack}_aems_automation_role",
            assumed_by=iam.ServicePrincipal("lambda.amazonaws.com"),
            inline_policies={
                f"{stack}_aems_automation_policy":
                    iam.PolicyDocument(
                        statements=[
                            iam.PolicyStatement(
                                effect=iam.Effect.ALLOW,
                                resources=['*'],
                                actions=[
                                    "mediaconnect:ListFlows",
                                    "mediaconnect:StartFlow",
                                    "mediaconnect:StopFlow",
                                ]
                            ),
                            iam.PolicyStatement(
                                effect=iam.Effect.ALLOW,
                                resources=['*'],
                                actions=[
                                    "medialive:ListChannels",
                                    "medialive:DescribeChannel",
                                    "medialive:DescribeInput",
                                    "medialive:ListInputs",
                                    "medialive:BatchStart",
                                    "medialive:BatchStop",
                                    "medialive:BatchDelete",
                                    "medialive:StartChannel",
                                    "medialive:StopChannel",
                                    "medialive:DeleteChannel",
                                    "medialive:DeleteInput",
                                ]
                            ),
                            iam.PolicyStatement(
                                effect=iam.Effect.ALLOW,
                                resources=['*'],
                                actions=[
                                    "mediapackage:DescribeOriginEndpoint",
                                ]
                            ),
                            iam.PolicyStatement(
                                effect=iam.Effect.ALLOW,
                                resources=['*'],
                                actions=[
                                    "mediatailor:PutPlaybackConfiguration",
                                    "mediatailor:DeletePlaybackConfiguration",
                                ]
                            ),
                            iam.PolicyStatement(
                                effect=iam.Effect.ALLOW,
                                resources=['*'],
                                actions=[
                                    "logs:CreateLogGroup",
                                    "logs:CreateLogStream",
                                    "logs:PutLogEvents",
                                    "logs:DescribeLogStreams",
                                    "logs:DescribeLogGroups",
                                ]
                            ),
                            iam.PolicyStatement(
                                effect=iam.Effect.ALLOW,
                                resources=['*'],
                                actions=[
                                    "lambda:DeleteFunction",
                                ]
                            ),
                            iam.PolicyStatement(
                                effect=iam.Effect.ALLOW,
                                resources=['*'],
                                actions=[
                                    "eventbridge:DeleteRule",
                                ]
                            ),
                            iam.PolicyStatement(
                                effect=iam.Effect.ALLOW,
                                resources=['*'],
                                actions=[
                                    "iam:DeleteRole",
                                ]
                            )
                        ]
                    )
            },
        )
