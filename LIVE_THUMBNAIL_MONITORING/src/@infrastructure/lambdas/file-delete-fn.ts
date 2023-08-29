import { Role } from "aws-cdk-lib/aws-iam";
import { Code, Function as Fn, Runtime } from "aws-cdk-lib/aws-lambda";
import { Duration, Stack } from "aws-cdk-lib";

export function createFileDeleteLambda(scope: Stack, role: Role, bucketName: string): Fn {
  return new Fn(scope, "deletethumbnailfn", {
    code: Code.fromAsset("./dist"),
    handler: "delete-thumbnails-contents.handler",
    runtime: Runtime.NODEJS_18_X,
    role,
    timeout: Duration.seconds(30),
    environment: {
      THUMBNAIL_BUCKET: bucketName,
    },
  });
}
