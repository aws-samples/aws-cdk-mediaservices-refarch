import { CfnOutput, Stack } from "aws-cdk-lib";
import { LambdaIntegration, RestApi, Cors, AuthorizationType, MethodLoggingLevel } from "aws-cdk-lib/aws-apigateway";
import { Role, AccountPrincipal, PolicyStatement, Effect, PolicyDocument } from "aws-cdk-lib/aws-iam";
import { Function as Fn } from "aws-cdk-lib/aws-lambda";
import { NagSuppressions } from "cdk-nag";

/**
 * Create RestApi for Harvesting Clips
 *
 * Protected by IAM_ROLE
 */
export function createHarvestApi(stack: Stack, lambda: Fn): RestApi {
  const integration = new LambdaIntegration(lambda);

  const api = new RestApi(stack, "harvest-api", {
    defaultCorsPreflightOptions: {
      allowOrigins: Cors.ALL_ORIGINS,
      allowMethods: Cors.ALL_METHODS,
    },
    cloudWatchRole: true,
    deployOptions: {
      loggingLevel: MethodLoggingLevel.ERROR,
    },
  });

  const method = api.root.addResource("harvest").addMethod("POST", integration, {
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

  new CfnOutput(stack, "harvest-api-endpoint-output", {
    exportName: `${stack.stackName}-harvest-api-endpoint`,
    value: `${api.url}harvest`,
  });

  new CfnOutput(stack, "harvest-api-role", {
    exportName: `${stack.stackName}-harvest-api-role`,
    value: executeApiRole.roleArn,
  });

  NagSuppressions.addResourceSuppressions(method, [
    {
      id: "AwsSolutions-COG4",
      reason: "RestApi uses IAM auth instead of Cognito.",
    },
  ]);

  NagSuppressions.addResourceSuppressionsByPath(stack, "MediaServicesRefArch-L2V-harvestapi-stack/harvest-api/Default/OPTIONS/Resource", [
    {
      id: "AwsSolutions-APIG4",
      reason: "RestApi uses IAM auth.",
    },
    {
      id: "AwsSolutions-COG4",
      reason: "RestApi uses IAM auth instead of Cognito.",
    },
  ]);

  NagSuppressions.addResourceSuppressionsByPath(stack, "MediaServicesRefArch-L2V-harvestapi-stack/harvest-api/DeploymentStage.prod/Resource", [
    {
      id: "AwsSolutions-APIG3",
      reason: "No WAFv2 associated with RestApi",
    },
  ]);

  NagSuppressions.addResourceSuppressionsByPath(stack, "MediaServicesRefArch-L2V-harvestapi-stack/harvest-api/CloudWatchRole/Resource", [
    {
      id: "AwsSolutions-IAM4",
      reason: "The IAM user, role, or group uses AWS managed policies",
    },
  ]);
  NagSuppressions.addResourceSuppressionsByPath(stack, "MediaServicesRefArch-L2V-harvestapi-stack/harvest-api/Default/harvest/OPTIONS/Resource", [
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
