import { Role } from "aws-cdk-lib/aws-iam";
import { Code, Function as Fn, Runtime } from "aws-cdk-lib/aws-lambda";
import { Duration, Stack } from "aws-cdk-lib";

export function createThumbnailLambda(scope: Stack, role: Role, bucketName: string): Fn {
  return new Fn(scope, "thumbnailsfn", {
    code: Code.fromAsset("./dist"),
    handler: "fetch-thumbnails.handler",
    runtime: Runtime.NODEJS_18_X,
    role,
    timeout: Duration.seconds(30),
    environment: {
      THUMBNAIL_BUCKET: bucketName,
    },
  });
}
