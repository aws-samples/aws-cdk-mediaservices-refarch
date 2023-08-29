import { App, CfnOutput, Stack } from "aws-cdk-lib";
import { Role, ServicePrincipal, PolicyStatement, Effect, PolicyDocument, ManagedPolicy } from "aws-cdk-lib/aws-iam";
import { STACK_PREFIX_NAME } from "..";
import { createThumbnailApi } from "../api/create-thumbnail-api";
import { createThumbnailLambda } from "../lambdas/thumbnail-fn";
import { BlockPublicAccess, Bucket, BucketEncryption } from "aws-cdk-lib/aws-s3";
import { Rule, Schedule } from "aws-cdk-lib/aws-events";
import { LambdaFunction } from "aws-cdk-lib/aws-events-targets";
import { createFileDeleteLambda } from "../lambdas/file-delete-fn";
import { NagSuppressions } from "cdk-nag";

export function createthumbnailApiStack(app: App): void {
  const stack = new Stack(app, `${STACK_PREFIX_NAME}-thumbnails-api-stack`, {
    env: {
      region: process.env.CDK_DEFAULT_REGION,
      account: process.env.CDK_DEFAULT_ACCOUNT,
    },
  });

  const bucket = new Bucket(stack, "image-frame-capture", {
    encryption: BucketEncryption.S3_MANAGED,
    blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
    enforceSSL: true,
  });

  // Role for lambda
  const thumbnailIamRole = new Role(stack, "thumbnail-role", {
    assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
    managedPolicies: [ManagedPolicy.fromManagedPolicyArn(stack, "lambda-managed", "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole")],
    inlinePolicies: {
      inline: new PolicyDocument({
        statements: [
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ["medialive:DescribeThumbnails", "medialive:DescribeChannel"],
            resources: ["*"],
          }),
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ["s3:ListBucket", "s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
            resources: [bucket.bucketArn, `${bucket.bucketArn}/*`],
          }),
        ],
      }),
    },
  });

  const lambda = createThumbnailLambda(stack, thumbnailIamRole, bucket.bucketName);

  const rule = new Rule(stack, "fiveMinuteRule", {
    schedule: Schedule.cron({ minute: "0/5" }),
  });
  const deleteLambda = createFileDeleteLambda(stack, thumbnailIamRole, bucket.bucketName);
  rule.addTarget(new LambdaFunction(deleteLambda));

  createThumbnailApi(stack, lambda);

  new CfnOutput(stack, "bucket-name-output", {
    value: bucket.bucketName,
    exportName: "thumbnail-bucket-name",
  });

  NagSuppressions.addResourceSuppressions(thumbnailIamRole, [
    {
      id: "AwsSolutions-IAM4",
      reason: "Lambda supression for reporting to Cloudwatch",
      appliesTo: ["Policy::arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"],
    },
  ]);
  NagSuppressions.addResourceSuppressionsByPath(stack, "MediaServicesRefArch-thumbnails-api-stack/thumbnail-role/Resource", [
    {
      id: "AwsSolutions-IAM5",
      reason: "Allow readonly access to MediaLive channels",
    },
  ]);
  NagSuppressions.addResourceSuppressions(bucket, [
    {
      id: "AwsSolutions-S1",
      reason: "Used as origin for thumbnails only",
    },
  ]);
}
