#!/usr/bin/env python3

# author:       Emmanuel Etheve
# email:        ethevee@amazon.com
# description:  This is the core file of the LILO application
#               This file contain the logic and code to build the LILO application
# created:      17/05/2021 (dd/mm/yyyy)
# modified:     30/08/2021 (dd/mm/yyyy)
# filename:     app.py

from aws_cdk import core as cdk
from lilo.lilo_stack import LiloStack
from lilo.iam_nested_stack import iam_nested_stack
from lilo.medialive_nested_stack import medialive_nested_stack
from lilo.lilo_automation_nested_stack import lilo_automation_nested_stack

# Automation
auto_start = True  # automatically start flows and channel

# stack configuration
my_region = 'eu-west-1'  # aws region to be used
my_customer_name = 'Client'   # customer, department or company name of who is the owner of the stack
my_stack_name = "Dev"  # name to be used for the stack also know as workflow name
my_project_name = "LILO"  # project name to be used for resources in the stack

# MediaLive parameters
# file S3 path and name to be used for the loop
source = "s3ssl://refarch-public/Sizzle2021.mp4"
# destination IP
destination = "127.0.0.1"
# destination port number
port = 5000

lilo = cdk.App()
core = LiloStack(
  lilo,
  my_stack_name + my_customer_name,
  env={'region': my_region}
)

permission = iam_nested_stack(
  core,
  f"{my_customer_name}_Iam",
  stack=my_stack_name,
)

automation = lilo_automation_nested_stack(
  core,
  f"{my_customer_name}_Auto",
  auto_start=auto_start,
  stack_name=my_stack_name,
  role=permission.aems_automation_role,
)

channel = medialive_nested_stack(
  core,
  f"{my_customer_name}_Eml",
  source=source,
  destination=destination,
  port=port,
  role=permission.LiloMediaLiveAccessRole,
  stack_name=my_stack_name
)
channel.add_dependency(permission)
channel.add_dependency(automation)

lilo.synth()
