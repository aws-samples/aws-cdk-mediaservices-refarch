import { APIGatewayEventRequestContext, APIGatewayProxyCallbackV2, APIGatewayProxyEvent } from "aws-lambda";
import * as AWS from "aws-sdk";
import { DescribeChannelResponse } from "aws-sdk/clients/medialive";
import { GetObjectOutput } from "aws-sdk/clients/s3";
import { isDefined } from "ts-is-present";
import * as pino from "pino";

const eml = new AWS.MediaLive();
const s3 = new AWS.S3();

interface IS3FetchFileResponse {
  key?: string;
  file?: string;
  lastModified?: Date;
}

const logger = pino.pino({
  level: "debug",
});

export async function handler(event: APIGatewayProxyEvent, _context: APIGatewayEventRequestContext, callback: APIGatewayProxyCallbackV2): Promise<void> {
  const bucketName = process.env.THUMBNAIL_BUCKET;
  if (!bucketName) {
    return callback(null, {
      body: "No bucket name in environment",
      headers: {
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
      },
      isBase64Encoded: false,
      statusCode: 500,
    });
  }

  try {
    const channelId = event.pathParameters!.channelId!;
    if (!channelId) {
      return callback(null, {
        body: JSON.stringify("No ChannelId"),
        statusCode: 500,
      });
    }

    const channelInfo = await getChannelInfo(channelId).catch((error) => {
      return callback(null, {
        body: JSON.stringify("No channel"),
        statusCode: 500,
      });
    });

    if (channelInfo?.State !== "RUNNING") {
      return callback(null, {
        body: JSON.stringify("Channel not in Running State"),
        statusCode: 500,
      });
    }

    const channelThumbnailIds = processThumbnailIds(channelInfo);
    if (!channelThumbnailIds) {
      return callback(null, {
        body: JSON.stringify("Channel has no thumbnails ID's fetchable in MediaLive config"),
        statusCode: 500,
      });
    }

    const { thumbnailPipeline1, thumbnailPipeline2 } = await fetchInputThumbnailPreviews(channelId);

    if ((!thumbnailPipeline1 && !thumbnailPipeline2) || (Object.keys(thumbnailPipeline1).length === 0 && Object.keys(thumbnailPipeline2).length === 0)) {
      return callback(null, {
        body: "Channel Not Found",
        headers: {
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
        },
        isBase64Encoded: false,
        statusCode: 500,
      });
    }

    const filesForOutput = await fetchEmlOpsOutputInS3(bucketName, channelThumbnailIds);

    const emlInputHtml = createHtmlTemplateForEmlInput(thumbnailPipeline1, thumbnailPipeline2);

    const html = generateHtmlResponse(emlInputHtml, filesForOutput);

    return callback(null, {
      body: html,
      headers: {
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
        "Content-Type": "text/html",
      },
      isBase64Encoded: false,
      statusCode: 200,
    });
  } catch (error) {
    logger.error(error);
    return callback(null, {
      body: JSON.stringify("Something Went Wrong"),
      statusCode: 500,
    });
  }
}

/**
 * Generates a simple HTML response - including data from S3 + MediaLive
 */
function generateHtmlResponse(emlInputHtml: string, filesForOutput: IS3FetchFileResponse[]): string {
  return `
    <!DOCTYPE html>
<html>
  <head>
    <title>MediaLive Monitoring</title>
    <meta http-equiv="refresh" content="5" >
  </head>
  <body>
    <div style="text-align: center;">
      <div style="display: inline-block">
        <h1>MediaLive Source</h1>
        ${emlInputHtml}
      </div>
      <div style="display: inline-block">
        <h1>MediaLive Output</h1>
        ${
          filesForOutput.length > 0
            ? filesForOutput
                .map((fileInfo) => {
                  if (fileInfo.key && fileInfo.lastModified && fileInfo.file) {
                    return `
              <br>${fileInfo.key}</br>
              <br>${fileInfo.lastModified.toISOString()}</br>
              <img src="data:image/jpeg;base64, ${fileInfo.file}" alt="Input" style="width:480px;height:270px;"/>`;
                  }
                  return "";
                })
                .join("")
            : ""
        }
      </div>
    </div>
  </body>
</html>`;
}

/**
 * Produces HTML templates for pipeline 0 & 1 respectively
 */
function createHtmlTemplateForEmlInput(
  thumbnailPipeline1: AWS.MediaLive.DescribeThumbnailsResponse,
  thumbnailPipeline2: AWS.MediaLive.DescribeThumbnailsResponse,
): string {
  const htmlSnippets = [];

  if (thumbnailPipeline1 && Object.keys(thumbnailPipeline1).length > 0) {
    htmlSnippets.push(`
    <br>Pipeline 0</br>
    <br>${thumbnailPipeline1.ThumbnailDetails![0].Thumbnails![0].TimeStamp!.toISOString()}</br>
    <img src="data:image/jpeg;base64, ${thumbnailPipeline1.ThumbnailDetails![0].Thumbnails![0].Body!}" alt="pipeline1" />
    `);
  }

  if (thumbnailPipeline2 && Object.keys(thumbnailPipeline2).length > 0) {
    htmlSnippets.push(`
    <br>Pipeline 1</br>
    <br>${thumbnailPipeline2.ThumbnailDetails![0].Thumbnails![0].TimeStamp!.toISOString()}</br>
    <img src="data:image/jpeg;base64, ${thumbnailPipeline2.ThumbnailDetails![0].Thumbnails![0].Body!}" alt="pipeline2" />
    `);
  }
  return htmlSnippets.join("");
}

/**
 * Fetches list of files from S3 bucket, it then reduces files based on timestamp to ensure if gets the "latest" frame captures.
 */
async function fetchEmlOpsOutputInS3(bucketName: string, channelThumbnailIds: string[] | undefined): Promise<IS3FetchFileResponse[]> {
  const files = await s3
    .listObjectsV2({
      Bucket: bucketName,
    })
    .promise();

  const latestFiles = channelThumbnailIds?.map((channelIdThumbnail) => {
    return files.Contents?.filter((filer) => filer.Key?.startsWith(`${channelIdThumbnail}_`)).reduce(function (prev, current) {
      return prev.LastModified! > current.LastModified! ? prev : current;
    });
  });

  const filesForOutput = await Promise.all(
    latestFiles!.map(async (item) => {
      if (item?.Key) {
        const data = await getS3Object(item.Key, bucketName);
        return {
          key: item.Key,
          file: data.Body!.toString("base64"),
          lastModified: data.LastModified,
        };
      }
      return undefined;
    }),
  );
  return filesForOutput.filter(isDefined);
}

/**
 * Makes calls to MediaLive channel to fetch thumbnails for the channel (returns a promise)
 */
async function fetchInputThumbnailPreviews(
  channelId: string,
): Promise<{ thumbnailPipeline1: AWS.MediaLive.DescribeThumbnailsResponse; thumbnailPipeline2: AWS.MediaLive.DescribeThumbnailsResponse }> {
  const thumbnailPipeline1 = await eml
    .describeThumbnails({
      ChannelId: channelId,
      PipelineId: "0",
      ThumbnailType: "CURRENT_ACTIVE",
    })
    .promise();

  const thumbnailPipeline2 = await eml
    .describeThumbnails({
      ChannelId: channelId,
      PipelineId: "1",
      ThumbnailType: "CURRENT_ACTIVE",
    })
    .promise();
  return { thumbnailPipeline1, thumbnailPipeline2 };
}

/**
 * From MediaLive Channel - process the destinations
 * Your Output name for "Frame Capture" needs to have "operations" in the name so the lambda knows what output information to use i.e. to fetch the channel name
 */
function processThumbnailIds(channelInfo: AWS.MediaLive.DescribeChannelResponse): string[] | undefined {
  const outputs = channelInfo.EncoderSettings?.OutputGroups;
  const thumbnailOutputId = outputs
    ?.map((output) => {
      if (output.OutputGroupSettings.FrameCaptureGroupSettings && output.Name?.includes("operations")) {
        return output.OutputGroupSettings.FrameCaptureGroupSettings.Destination.DestinationRefId;
      }
      return undefined;
    })
    .filter(isDefined);

  const channelThumbnailIds: string[] | undefined = channelInfo.Destinations?.map((output) => {
    if (output.Id == thumbnailOutputId) {
      return output.Settings?.map((dest) => {
        const items = dest.Url?.split("/");
        return items && items.length > 0 ? items[items.length - 1] : undefined;
      }).filter(isDefined);
    }
    return undefined;
  })
    .filter(isDefined)
    .flat(1);

  return channelThumbnailIds;
}

/**
 * Get channel info from the MediaLive Channel
 */
function getChannelInfo(channelId: string): Promise<DescribeChannelResponse> {
  return new Promise((resolve, reject) => {
    try {
      eml
        .describeChannel({
          ChannelId: channelId,
        })
        .promise()
        .then((result) => {
          return resolve(result);
        })
        .catch((error) => {
          reject(error);
        });
    } catch (e) {
      reject(undefined);
    }
  });
}

/**
 * Gets file from S3
 */
function getS3Object(fileId: string, bucketName: string): Promise<GetObjectOutput> {
  return new Promise((resolve, reject) => {
    try {
      s3.getObject({
        Bucket: bucketName,
        Key: fileId,
      })
        .promise()
        .then((result) => {
          return resolve(result);
        })
        .catch((error) => {
          reject(error);
        });
    } catch (e) {
      reject(e);
    }
  });
}
