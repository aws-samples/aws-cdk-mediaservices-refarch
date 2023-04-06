import { App, Stack } from "aws-cdk-lib";
import { Role, ServicePrincipal, PolicyStatement, Effect, PolicyDocument, ManagedPolicy } from "aws-cdk-lib/aws-iam";
import { NagSuppressions } from "cdk-nag";
import { STACK_PREFIX_NAME } from "..";
import { createHarvestApi } from "../api/create-harvest-api";
import { createHarvestClipLambda } from "../lambdas/harvest-clip-action-fn";
import { IPlayoutOutputs } from "./playout";

export interface IHarvestApiStackOutput {
  harvestIamMpRoleArn: string;
}

export function createHarvestApiStack(app: App, playoutOutputs: IPlayoutOutputs): IHarvestApiStackOutput {
  const stack = new Stack(app, `${STACK_PREFIX_NAME}-L2V-harvestapi-stack`, {
    env: {
      region: process.env.CDK_DEFAULT_REGION,
      account: process.env.CDK_DEFAULT_ACCOUNT,
    },
  });

  // Role will be assumed by mediapackage when the harvest job kicks off
  const harvestIamMpRole = new Role(stack, "harvest-mp-role", {
    assumedBy: new ServicePrincipal("mediapackage.amazonaws.com"),
    inlinePolicies: {
      inline: new PolicyDocument({
        statements: [
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ["s3:PutObject", "s3:GetObject", "s3:ListBucket", "s3:GetBucketLocation", "s3:GetBucketRequestPayment"],
            resources: [playoutOutputs.bucketArn, `${playoutOutputs.bucketArn}/*`],
          }),
        ],
      }),
    },
  });

  NagSuppressions.addResourceSuppressions(harvestIamMpRole, [
    {
      id: "AwsSolutions-IAM5",
      reason: "Policy required for MediaPackage.",
      appliesTo: ["Resource::*"],
    },
  ]);

  NagSuppressions.addResourceSuppressionsByPath(stack, "MediaServicesRefArch-L2V-harvestapi-stack/harvest-mp-role/Resource", [
    {
      id: "AwsSolutions-IAM5",
      reason: "Policy required for MP to write to S3.",
    },
  ]);

  // Role for lambda
  const harvestIamRole = new Role(stack, "harvest-role", {
    assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
    managedPolicies: [ManagedPolicy.fromManagedPolicyArn(stack, "lambda-managed", "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole")],
    inlinePolicies: {
      inline: new PolicyDocument({
        statements: [
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ["mediapackage:CreateHarvestJob"],
            resources: [`arn:aws:mediapackage:${stack.region}:${stack.account}:harvest_jobs/*`],
          }),
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ["iam:PassRole"],
            resources: [harvestIamMpRole.roleArn],
          }),
        ],
      }),
    },
  });

  NagSuppressions.addResourceSuppressions(harvestIamRole, [
    {
      id: "AwsSolutions-IAM4",
      reason: "Lambda supression for reporting to Cloudwatch",
      appliesTo: ["Policy::arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"],
    },
  ]);
  NagSuppressions.addResourceSuppressionsByPath(stack, "MediaServicesRefArch-L2V-harvestapi-stack/harvest-role/Resource", [
    {
      id: "AwsSolutions-IAM5",
      reason: "Allow access to MP to harvest jobs",
    },
  ]);

  const lambda = createHarvestClipLambda(stack, playoutOutputs.bucketName, harvestIamRole, harvestIamMpRole.roleArn);

  createHarvestApi(stack, lambda);

  return {
    harvestIamMpRoleArn: harvestIamMpRole.roleArn,
  };
}
