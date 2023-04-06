import { App, Duration, Stack } from "aws-cdk-lib";
import { Rule } from "aws-cdk-lib/aws-events";
import { LambdaFunction } from "aws-cdk-lib/aws-events-targets";
import { IMediaServicesOutput } from "./media-services";
import { Effect, ManagedPolicy, PolicyDocument, PolicyStatement, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { createHarvestCompleteFn } from "../lambdas/harvest-clip-completed-fn";
import { STACK_PREFIX_NAME } from "..";
import { NagSuppressions } from "cdk-nag";

export function getHarvestCompleteStack(app: App, props: IMediaServicesOutput, harvestIamMpRoleArn: string): void {
  const stack = new Stack(app, `${STACK_PREFIX_NAME}-L2V-harvestcomplete-stack`, {
    env: {
      region: process.env.CDK_DEFAULT_REGION,
      account: process.env.CDK_DEFAULT_ACCOUNT,
    },
  });

  // Capturing MediaPackage HarvestJob Notification
  // https://docs.aws.amazon.com/mediapackage/latest/ug/cloudwatch-events-example.html
  const rule = new Rule(stack, "harvest-complete-rule", {
    eventPattern: {
      source: ["aws.mediapackage"],
      detailType: ["MediaPackage HarvestJob Notification"],
    },
  });

  const harvestCompleteIamRole = new Role(stack, "harvest-role", {
    assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
    managedPolicies: [ManagedPolicy.fromManagedPolicyArn(stack, "managed-policy", "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole")],
    inlinePolicies: {
      inline: new PolicyDocument({
        statements: [
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ["mediapackage-vod:CreateAsset"],
            resources: [`arn:aws:mediapackage-vod:${stack.region}:${stack.account}:assets/*`],
          }),
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ["iam:PassRole"],
            resources: [harvestIamMpRoleArn],
          }),
        ],
      }),
    },
  });

  NagSuppressions.addResourceSuppressions(harvestCompleteIamRole, [
    {
      id: "AwsSolutions-IAM4",
      reason: "Lambda supression for reporting to CloudWatch",
    },
  ]);
  NagSuppressions.addResourceSuppressionsByPath(stack, "MediaServicesRefArch-L2V-harvestcomplete-stack/harvest-role/Resource", [
    {
      id: "AwsSolutions-IAM5",
      reason: "Allow access to create VOD assets in MP",
    },
  ]);

  const fn = createHarvestCompleteFn(stack, {
    role: harvestCompleteIamRole,
    mpVodPackagingGroupId: props.mpVodPackagingGroup,
  });

  rule.addTarget(
    new LambdaFunction(fn, {
      maxEventAge: Duration.hours(2),
      retryAttempts: 2,
    }),
  );
}
