import { App, RemovalPolicy, Stack } from "aws-cdk-lib";
import { BlockPublicAccess, Bucket, BucketEncryption } from "aws-cdk-lib/aws-s3";
import { NagSuppressions } from "cdk-nag";
import { STACK_PREFIX_NAME } from "..";

export interface IPlayoutOutputs {
  bucketName: string;
  bucketArn: string;
}

/**
 * Create VOD Playout stack - the destination of the harvested clips.
 */
export function createPlayoutStack(app: App): IPlayoutOutputs {
  const stack = new Stack(app, `${STACK_PREFIX_NAME}-L2V-vodassets-stack`, {
    env: {
      region: process.env.CDK_DEFAULT_REGION,
      account: process.env.CDK_DEFAULT_ACCOUNT,
    },
  });

  const bucket = new Bucket(stack, "clips-origin", {
    removalPolicy: RemovalPolicy.DESTROY, // Destroy when you delete the stack
    blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
    encryption: BucketEncryption.S3_MANAGED,
  });

  NagSuppressions.addResourceSuppressions(bucket, [
    {
      id: "AwsSolutions-S1",
      reason: "No server access logs enabled for S3 bucket created.",
    },
    {
      id: "AwsSolutions-S10",
      reason: "Bucket disable SSL for MediaPackage to read from S3.",
    },
  ]);

  return {
    bucketName: bucket.bucketName,
    bucketArn: bucket.bucketArn,
  };
}
