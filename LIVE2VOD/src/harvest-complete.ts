import { APIGatewayEventRequestContext, Callback } from "aws-lambda";
import * as AWS from "aws-sdk";

const mp = new AWS.MediaPackageVod();

enum HarvestJob {
  SUCCEEDED = "SUCCEEDED",
  FAILED = "FAILED",
}

interface IMediaPackageEvent {
  detail: {
    harvest_job: {
      id: string;
      status: string;
      s3_destination: {
        bucket_name: string;
        manifest_key: string;
        role_arn: string;
      };
    };
  };
}

export async function handler(event: IMediaPackageEvent, _context: APIGatewayEventRequestContext, callback: Callback): Promise<void> {
  const mpVodPackagingGroup = process.env.MP_VOD_PACKAGING_GROUP;
  if (!mpVodPackagingGroup) {
    return callback(null, {
      statusCode: 400,
      headers: {
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
      },
      body: "Missing MP Packaging Group",
    });
  }

  const harvestJob = event.detail.harvest_job;
  const id: string = harvestJob.id;
  const status: string = harvestJob.status;
  const bucketName: string = harvestJob.s3_destination.bucket_name;
  const manifestKey: string = harvestJob.s3_destination.manifest_key;
  const roleArn: string = harvestJob.s3_destination.role_arn;

  if (status == HarvestJob.FAILED) {
    return callback(null, {
      statusCode: 400,
      headers: {
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
      },
      body: "Harvest Failed",
    });
  }

  const mpAsset = await mp
    .createAsset({
      Id: id,
      PackagingGroupId: mpVodPackagingGroup,
      SourceArn: `arn:aws:s3:::${bucketName}/${manifestKey}`,
      SourceRoleArn: roleArn,
    })
    .promise();

  if (!mpAsset || !mpAsset.EgressEndpoints) {
    return callback(null, {
      statusCode: 400,
      headers: {
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
      },
      body: "Something went wrong",
    });
  }

  return callback(null, {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
    },
    body: "ok",
  });
}
