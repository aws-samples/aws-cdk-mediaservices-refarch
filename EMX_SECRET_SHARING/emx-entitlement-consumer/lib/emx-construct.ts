import { CustomResource } from "aws-cdk-lib";
import { CfnFlow } from "aws-cdk-lib/aws-mediaconnect";
import { Role, ServicePrincipal, PolicyDocument, PolicyStatement, Effect, Policy } from "aws-cdk-lib/aws-iam";
import { Code, Runtime, Function } from "aws-cdk-lib/aws-lambda";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { PhysicalResourceId, Provider } from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { Topic } from "aws-cdk-lib/aws-sns";
import { SqsSubscription } from "aws-cdk-lib/aws-sns-subscriptions";
import { NagSuppressions } from "cdk-nag";
import { Key } from "aws-cdk-lib/aws-kms";
import { ALGORITHM } from "./helpers/algorithm";
import { parseEntitlementArn } from "./helpers/arn-parsers";
import { STACK_PREFIX_NAME } from ".";

export interface ConsumeEmxEntitlementProps {
  /**
   * Entitlement ARN from the granter account
   */
  entitlementArn: string;
  /**
   * Secret ARN from the granter account
   */
  secretArn: string;
  /**
   * If they are using CloudTrail, they can setup to alert you - to do this you need the SNS Topic ARN from from the granter account.
   * You can use `undefined` if you have not received it.
   */
  snsArn?: string;
  /**
   * Ensure you use the same Encryption Algorithm that the granter account has used.
   */
  encryptionAlgorithm: ALGORITHM;
  /**
   * This is the role you created in step 1 of the deployment.
   */
  fnRole: Role;
}

/**
 * Once the "supplier" has setup the configuration their side - you are now able to deploy this construct.
 *
 * This construct will do the flow setup, along with creating the custom resource etc.
 */
export class EmxEntitlementConsumer extends Construct {
  constructor(scope: Construct, private props: ConsumeEmxEntitlementProps) {
    super(scope, "entitlementconsume");

    const policy = new Policy(this, "inline-policy", {
      document: new PolicyDocument({
        statements: [
          new PolicyStatement({
            actions: [
              "secretsmanager:GetSecretValue",
            ],
            effect: Effect.ALLOW,
            resources: [this.props.secretArn],
          }),
          new PolicyStatement({
            actions: ["secretsmanager:UpdateSecret"],
            effect: Effect.ALLOW,
            resources: [this.decryptionSecret.secretArn],
          }),
          new PolicyStatement({
            actions: [
              "kms:DescribeKey",
              "kms:Decrypt",
            ],
            effect: Effect.ALLOW,
            resources: [this.key.keyArn],
          }),
          new PolicyStatement({
            actions: [
              "kms:DescribeKey",
              "kms:Decrypt",
              "kms:GenerateDataKey*",
            ],
            effect: Effect.ALLOW,
            resources: ["*"], // Give * as the granter might not want to give KMS ARN directly (this is for the granter account)
          }),
        ],
      }),
    });
    this.props.fnRole.attachInlinePolicy(policy);

    this.fetchSecretFunction.addEventSource(new SqsEventSource(this.sqs));

    // If SNS ARN isn't specific, solution will still create an SQS but won't attempt to add the subscription to the SNS topic.
    if(this.props.snsArn && this.props.snsArn != ""){
      const topic = Topic.fromTopicArn(this, "topic", this.props.snsArn);
      topic.addSubscription(new SqsSubscription(this.sqs));
    }

    NagSuppressions.addResourceSuppressions(this.decryptionSecret, [
      { id: 'AwsSolutions-SMG4', reason: 'This is not a solution to allow secret rotation. Suppressing automatic rotation.' },
    ]);
    NagSuppressions.addResourceSuppressions(this.sqs, [
      { id: 'AwsSolutions-SQS3', reason: 'No DLQ Implemented for sample, you might want to consider implementing one for a production workload.' },
    ]);
    NagSuppressions.addResourceSuppressions(
      this.fetchSecretProvider,
      [
        {
          id: 'AwsSolutions-IAM4',
          reason: 'Lambda has `AWSLambdaBasicExecutionRole` attached for CloudWatch logging',
        },
        {
          id: 'AwsSolutions-IAM5',
          reason: 'Automatically provided access via creating a Custom Resource.'
        }
      ], true
    );
    NagSuppressions.addResourceSuppressions(
      policy,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'kms:GenerateDataKey* and Resource:* is needed to allow access to KMS in granting account - granter might not want to give KMS ARN directly'
        }
      ], true
    );
    NagSuppressions.addResourceSuppressions(
      this.fetchSecretFunction,
      [
        {
          id: 'AwsSolutions-L1',
          reason: 'Use latest lambda version in each region'
        }
      ], true
    );
  }

  protected key = new Key(this, `${parseEntitlementArn(this.props.entitlementArn)}-emx-cmk-key`, {
    alias: `emx-cmk-key/${parseEntitlementArn(this.props.entitlementArn)}`,
    enableKeyRotation: true,
  });

  private decryptionSecret = new Secret(this, "emx-decryption-secret", {
    secretName: `EmxEntitlementConsumer/${parseEntitlementArn(this.props.entitlementArn)}`,
    description: `Secret for MediaConnect Flow Output Entitlement from ${parseEntitlementArn(this.props.entitlementArn)}`,
    encryptionKey: this.key
  });

  protected fetchSecretFunction = new Function(this, "fetch-secret-fn", {
    code: Code.fromAsset(`${__dirname}/../lambda`),
    handler: "index.handler",
    runtime: Runtime.NODEJS_20_X,
    role: this.props.fnRole,
    environment: {
      GRANTED_SECRET: this.props.secretArn,
      CONSUMER_SECRET: this.decryptionSecret.secretName,
    },
  });

  protected fetchSecretProvider = new Provider(this, "cr-provider", {
    onEventHandler: this.fetchSecretFunction,
  });

  protected fetchSecretCustomResource = new CustomResource(this, "fetch-secret-custom-resource", {
    resourceType: "Custom::FetchSecretFromEntitlementGranter",
    serviceToken: this.fetchSecretProvider.serviceToken,
    properties: {
      update: PhysicalResourceId.of(Date.now().toString()), // This is to retrigger the custom resource each deploy
    },
  });

  protected sqs = new Queue(this, "act-queue", {
    enforceSSL: true,
  });

  protected emxRole = new Role(this, "emx-role", {
    assumedBy: new ServicePrincipal("mediaconnect.amazonaws.com"),
    inlinePolicies: {
      main: new PolicyDocument({
        statements: [
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ["secretsmanager:GetSecretValue"],
            resources: [this.decryptionSecret.secretArn],
          }),
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ["kms:DescribeKey",
            "kms:Decrypt",],
            resources: [this.key.keyArn],
          }),
        ],
      }),
    },
  });

  public emx = new CfnFlow(this, "source", {
    name: `${STACK_PREFIX_NAME}-entitlement-source`,
    source: {
      entitlementArn: this.props.entitlementArn,
      decryption: {
        algorithm: this.props.encryptionAlgorithm.toLowerCase(),
        roleArn: this.emxRole.roleArn,
        secretArn: this.decryptionSecret.secretArn,
      },
    },
  });
}

