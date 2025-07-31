import { Role } from "aws-cdk-lib/aws-iam";
import { Code, Function as Fn, Runtime } from "aws-cdk-lib/aws-lambda";
import { Duration, Stack } from "aws-cdk-lib";

export function createHarvestClipLambda(scope: Stack, playoutBucketName: string, role: Role, mpRoleArn: string): Fn {
  return new Fn(scope, "start-harvest-fn", {
    code: Code.fromAsset("./dist"),
    handler: "start-harvest.handler",
    runtime: Runtime.NODEJS_22_X,
    role,
    timeout: Duration.seconds(30),
    environment: {
      DESTINATION_BUCKET: playoutBucketName,
      HARVEST_ROLE_ARN: mpRoleArn,
    },
  });
}
