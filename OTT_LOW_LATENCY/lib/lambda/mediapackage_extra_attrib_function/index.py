# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0
import boto3
import logging
emp_client = boto3.client('mediapackagev2')
ssm_client = boto3.client('ssm')
def lambda_handler(event, context):
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)
    logger.info (f"Input parameters from cloud formation: {event}")
    channelGroupName = event["mediaPackageChannelGroupName"]
    channelName = event["mediaPackageChannelName"]
    ssmNamePrefix = event["ssmNamePrefix"]
    logger.info("channelGroupName: %s" % channelGroupName)
    logger.info("channelName: %s" % channelName)
    logger.info("ssmNamePrefix: %s" % ssmNamePrefix)
    try:
        response = emp_client.get_channel(ChannelGroupName=channelGroupName, ChannelName=channelName)
        logger.info("Raw get_channel response:")
        logger.info(response)
        for ingestEndpoint in response['IngestEndpoints']:
            paramName = "%s-%s%s" % (ssmNamePrefix, "IngestEndpoint", ingestEndpoint["Id"]) 
            ssm_response = ssm_client.put_parameter(
                Name=paramName,
                Description='MediaPackage Channel %s/%s ingest point %s parameter' % (channelName, channelGroupName, ingestEndpoint["Id"]),
                Value=ingestEndpoint['Url'],
                Type='String',
                Overwrite=True
            )
            logger.info(ssm_response)
        return response
    except Exception as e:
        logger.error("Error Command - emp get channel " + channelName + " in channel group " + channelGroupName + "failed")
        print(e)
        logger.info(e)
