import { CfnOutput, Stack } from "aws-cdk-lib";
import { LambdaIntegration, RestApi, Cors, AuthorizationType, MethodLoggingLevel } from "aws-cdk-lib/aws-apigateway";
import { Role, AccountPrincipal, PolicyStatement, Effect, PolicyDocument } from "aws-cdk-lib/aws-iam";
import { Function as Fn } from "aws-cdk-lib/aws-lambda";
import { NagSuppressions } from "cdk-nag";

export function createThumbnailApi(stack: Stack, lambda: Fn): RestApi {
  const integration = new LambdaIntegration(lambda, {
    proxy: true,
  });

  const api = new RestApi(stack, "api", {
    defaultCorsPreflightOptions: {
      allowOrigins: Cors.ALL_ORIGINS,
      allowMethods: Cors.ALL_METHODS,
    },
    cloudWatchRole: true,
    deployOptions: {
      loggingLevel: MethodLoggingLevel.INFO,
    },
    binaryMediaTypes: ["*/*"],
  });

  const method = api.root.addResource("monitor").addResource("{channelId}").addMethod("GET", integration, {
    authorizationType: AuthorizationType.IAM,
  });

  const executeApiRole = new Role(stack, "auth-role", {
    assumedBy: new AccountPrincipal(stack.account),
    inlinePolicies: {
      inline: new PolicyDocument({
        statements: [
          new PolicyStatement({
            actions: ["execute-api:Invoke"],
            effect: Effect.ALLOW,
            resources: [method.methodArn],
          }),
        ],
      }),
    },
  });

  new CfnOutput(stack, "auth-role-arn", {
    value: executeApiRole.roleArn,
  });

  NagSuppressions.addResourceSuppressionsByPath(stack, "MediaServicesRefArch-thumbnails-api-stack/auth-role/Resource", [
    {
      id: "AwsSolutions-IAM5",
      reason: "Allow role to execute API with path",
    },
  ]);

  NagSuppressions.addResourceSuppressions(method, [
    {
      id: "AwsSolutions-COG4",
      reason: "RestApi uses IAM auth instead of Cognito.",
    },
  ]);

  NagSuppressions.addResourceSuppressionsByPath(stack, "MediaServicesRefArch-thumbnails-api-stack/api/Default/OPTIONS/Resource", [
    {
      id: "AwsSolutions-APIG4",
      reason: "RestApi uses IAM auth.",
    },
    {
      id: "AwsSolutions-COG4",
      reason: "RestApi uses IAM auth instead of Cognito.",
    },
  ]);

  NagSuppressions.addResourceSuppressionsByPath(stack, "MediaServicesRefArch-thumbnails-api-stack/api/Default/monitor/OPTIONS/Resource", [
    {
      id: "AwsSolutions-APIG4",
      reason: "RestApi uses IAM auth.",
    },
    {
      id: "AwsSolutions-COG4",
      reason: "RestApi uses IAM auth instead of Cognito.",
    },
  ]);

  NagSuppressions.addResourceSuppressionsByPath(stack, "MediaServicesRefArch-thumbnails-api-stack/api/DeploymentStage.prod/Resource", [
    {
      id: "AwsSolutions-APIG3",
      reason: "No WAFv2 associated with RestApi",
    },
  ]);

  NagSuppressions.addResourceSuppressionsByPath(stack, "MediaServicesRefArch-thumbnails-api-stack/api/CloudWatchRole/Resource", [
    {
      id: "AwsSolutions-IAM4",
      reason: "The IAM user, role, or group uses AWS managed policies",
    },
  ]);
  NagSuppressions.addResourceSuppressionsByPath(stack, "MediaServicesRefArch-thumbnails-api-stack/api/Default/monitor/{channelId}/OPTIONS/Resource", [
    {
      id: "AwsSolutions-APIG4",
      reason: "RestApi uses IAM auth.",
    },
    {
      id: "AwsSolutions-COG4",
      reason: "RestApi uses IAM auth instead of Cognito.",
    },
  ]);

  NagSuppressions.addResourceSuppressions(api.deploymentStage, [
    {
      id: "AwsSolutions-APIG1",
      reason: "No Access Logging enabled for sample.",
    },
  ]);

  NagSuppressions.addResourceSuppressions(api, [
    {
      id: "AwsSolutions-APIG2",
      reason: "No request validation added to sample.",
    },
    {
      id: "AwsSolutions-APIG4",
      reason: "RestApi uses IAM auth.",
    },
    {
      id: "AwsSolutions-COG4",
      reason: "RestApi uses IAM auth instead of Cognito.",
    },
  ]);

  return api;
}
