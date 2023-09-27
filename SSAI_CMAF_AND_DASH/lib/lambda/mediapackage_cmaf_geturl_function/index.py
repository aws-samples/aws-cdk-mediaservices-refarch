# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0
import boto3
import logging
emp_client = boto3.client('mediapackage')
ssm_client = boto3.client('ssm')
def lambda_handler(event, context):
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)
    logger.info (f"Input parameters from cloud formation: {event}")
    endpointId = event["mediaPackageEndpointId"]
    ssmName = event["ssmName"]
    print(endpointId)
    try:
        response = emp_client.describe_origin_endpoint(Id=endpointId)
        logger.info(response)
        responseValue = str(response['CmafPackage']['HlsManifests'][0]['Url'])
        logger.info(responseValue)
        ssm_response = ssm_client.put_parameter(
            Name=ssmName,
            Description='Cmaf output Url',
            Value=responseValue,
            Type='String',
            Overwrite=True
        )
        logger.info(ssm_response)
        return responseValue
    except Exception as e:
        print("Error Command - emp origin endpoint ID " + endpointId + "failed")
        print(e)
        logger.info(e)
