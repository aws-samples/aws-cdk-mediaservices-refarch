import { APIGatewayEventRequestContext, APIGatewayProxyCallbackV2, APIGatewayProxyEvent } from "aws-lambda";
import * as AWS from "aws-sdk";
import { ListObjectsV2Request } from "aws-sdk/clients/s3";

const s3 = new AWS.S3();

/**
 * Deletes frame capture outputs from S3 bucket
 * This deletes all objects apart from 20 to try to minimize issues when the UI tries to GET a photo that has just been deleted by this lambda.
 */
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

  const contents = await getListingS3(bucketName);

  if (contents.length <= 20) {
    return callback(null, {
      body: "Not enough files to trigger a delete!",
      headers: {
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
        "Content-Type": "text/html",
      },
      isBase64Encoded: false,
      statusCode: 400,
    });
  }

  const chunkSize = 1000;
  // eslint-disable-next-line no-loops/no-loops
  for (let i = 1; i < contents.length - 20; i += chunkSize) {
    const chunk = contents.slice(i, i + chunkSize);

    await s3
      .deleteObjects({
        Bucket: bucketName,
        Delete: {
          Objects: chunk.map((key) => ({ Key: key })),
        },
      })
      .promise();
  }

  return callback(null, {
    body: "Done!",
    headers: {
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
      "Content-Type": "text/html",
    },
    isBase64Encoded: false,
    statusCode: 200,
  });
}

/**
 * Fetches S3 files in bucket - uses recursion to ensure all files are returned (and not just a subset)
 */
export function getListingS3(bucketName: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    try {
      const params: ListObjectsV2Request = {
        Bucket: bucketName,
        MaxKeys: 1000,
      };
      const allKeys: string[] = [];
      listAllKeys();

      // eslint-disable-next-line no-inner-declarations
      function listAllKeys(): void {
        s3.listObjectsV2(params, function (err, data) {
          if (err) {
            reject(err);
          } else {
            data.Contents!.forEach(function (content) {
              allKeys.push(content.Key!);
            });

            if (data.IsTruncated) {
              params.ContinuationToken = data.NextContinuationToken!;
              listAllKeys();
            } else {
              resolve(allKeys);
            }
          }
        });
      }
    } catch (e) {
      reject(e);
    }
  });
}
