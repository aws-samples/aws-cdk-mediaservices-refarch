import { APIGatewayEventRequestContext, APIGatewayProxyCallbackV2, APIGatewayProxyEvent } from "aws-lambda";
import * as AWS from "aws-sdk";
import { CreateHarvestJobRequest } from "aws-sdk/clients/mediapackage";
import * as crypto from "crypto";

const mp = new AWS.MediaPackage();

interface IHarvestRequestBody {
  min: string;
  max: string;
  originId: string;
}

export async function handler(event: APIGatewayProxyEvent, _context: APIGatewayEventRequestContext, callback: APIGatewayProxyCallbackV2): Promise<void> {
  if (!event.body) {
    return callback(null, {
      statusCode: 400,
      headers: {
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
      },
      body: "No Event Body",
    });
  }

  const jsonBody: IHarvestRequestBody = JSON.parse(event.body) as IHarvestRequestBody;
  const startTime: string = jsonBody.min;
  const endTime: string = jsonBody.max;
  const originId: string = jsonBody.originId;

  if (!startTime || !endTime || !originId) {
    return callback(null, {
      statusCode: 400,
      headers: {
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
      },
      body: "Missing Harvest Configuration",
    });
  }

  const id = crypto.randomBytes(8).toString("hex");

  const s3Destination = process.env.DESTINATION_BUCKET;
  if (!s3Destination) {
    return callback(null, {
      statusCode: 400,
      headers: {
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
      },
      body: "Missing S3 Bucket",
    });
  }

  const harvestRoleArn = process.env.HARVEST_ROLE_ARN;
  if (!harvestRoleArn) {
    return callback(null, {
      statusCode: 400,
      headers: {
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
      },
      body: "Missing Harvest Role ARN",
    });
  }

  const params: CreateHarvestJobRequest = {
    Id: id,
    StartTime: startTime,
    EndTime: endTime,
    OriginEndpointId: originId,
    S3Destination: {
      BucketName: s3Destination,
      ManifestKey: `${id}/index.m3u8`,
      RoleArn: harvestRoleArn,
    },
  };

  const execute = await mp.createHarvestJob(params).promise();
  if (execute.$response.error) {
    return callback(null, {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
      },
      body: execute.$response.error.message,
    });
  }

  return callback(null, {
    statusCode: 201,
    headers: {
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
    },
    body: execute.Status,
  });
}
