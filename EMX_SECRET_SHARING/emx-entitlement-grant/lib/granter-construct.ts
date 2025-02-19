import { CfnOutput } from "aws-cdk-lib";
import { Rule } from "aws-cdk-lib/aws-events";
import { SnsTopic } from "aws-cdk-lib/aws-events-targets";
import { AccountPrincipal, ArnPrincipal, Effect, PolicyStatement, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { Key } from "aws-cdk-lib/aws-kms";
import { CfnFlow, CfnFlowEntitlement } from "aws-cdk-lib/aws-mediaconnect";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { Topic } from "aws-cdk-lib/aws-sns";
import { Construct } from "constructs";
import { NagSuppressions } from "cdk-nag";
import { ALGO, ALGORITHM } from "./helpers/algorithm";

export interface IEntitlementProps {
  /**
   * Identifier for the stream i.e. a channel ID or name
   * This is so we can name resources appropriately to make them easily recognisable.
   */
  streamIdentifier: string;
  /**
   * Algorithm used to encrypt the stream - this is important to also share with the consuming account.
   */
  algorithm: ALGORITHM;
  /**
   * Account ID to grant the entitlement to.
   */
  accountId: string;
  /**
   * Consumer Role ARN is created in the consumer account - i.e. this is the role you need from them which will access the Secrets Manager Resource.
   * 
   * This role will be granted least privilage on the secret.
   */
  consumerRoleArn: string;
  /**
   * Elemental MediaConnect Flow to create the Output Flow on.
   */
  emxFlow: CfnFlow;
  /**
   * Disable automatic alerting when key changes
   */
  disableKeyChangeAutoAlerting?: boolean;
}

/**
 * https://docs.aws.amazon.com/mediaconnect/latest/ug/encryption-static-key-set-up.html
 */
export class EmxEntitlementGrant extends Construct {
  constructor(scope: Construct, protected props: IEntitlementProps) {
    super(scope, `Grant${props.accountId}${props.streamIdentifier}`);

    this.secretsManager.grantRead(this.role);
    this.role.addToPrincipalPolicy(new PolicyStatement({
        actions: [
          "kms:DescribeKey",
          "kms:Decrypt",
          "kms:GenerateDataKey*"
        ],
        effect: Effect.ALLOW,
        resources: [this.keycmk.keyArn],
    }));

    // https://docs.aws.amazon.com/secretsmanager/latest/userguide/auth-and-access_examples_cross.html
    this.secretsManager.addToResourcePolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["secretsmanager:GetSecretValue"],
      principals: [
        new ArnPrincipal(this.props.consumerRoleArn)
      ],
      resources: ["*"]
    }));
    this.keycmk.addToResourcePolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["kms:Decrypt", "kms:DescribeKey", "kms:GenerateDataKey*",],
      resources: ["*"],
      principals: [
        new ArnPrincipal(this.props.consumerRoleArn),
      ]
    }));

    this.secretsManager.addToResourcePolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["secretsmanager:GetSecretValue"],
      principals: [
        new ArnPrincipal(this.role.roleArn)
      ],
      resources: ["*"]
    }));


    
    // CDK NAG Suppressions
    NagSuppressions.addResourceSuppressions(this.secretsManager, [
      { id: 'AwsSolutions-SMG4', reason: 'This is not a solution to allow secret rotation. Suppressing automatic rotation.' },
    ]);
    NagSuppressions.addResourceSuppressions(this.role, [
      { id: 'AwsSolutions-IAM5', reason: 'While testing it appears "kms:GenerateDataKey*" is required to allow solution to work.' },
    ], true);


    if(props.disableKeyChangeAutoAlerting != true){
      this.automaticAlerting();
    }
  }

  /**
   * AWS KMS Key to use on Secrets Manager Secret.
   * 
   * This is instead of using the default `aws/secretsmanager` AWS Managed Key.
   */
  protected keycmk = new Key(this, `${this.props.accountId}-${this.props.streamIdentifier}-emx-cmk-key`, {
    alias: `emx-cmk-key/${this.props.accountId}-${this.props.streamIdentifier}`,
    enableKeyRotation: true,
  });

  private excludedChars = "ghijklmnopqrstuvwxyz";
  protected secretsManager = new Secret(this, `emx-secret`, {
    secretName: `EmxEntitlementGrant/${this.props.accountId}-${this.props.streamIdentifier}`,
    generateSecretString: {
      excludeCharacters: [this.excludedChars, this.excludedChars.toUpperCase()].join(""),
      passwordLength: ALGO[this.props.algorithm],
      excludePunctuation: true,
    },
    description: `Secret for MediaConnect Flow Output Entitlement for ${this.props.streamIdentifier} to ${this.props.accountId}`,
    encryptionKey: this.keycmk,
  });

  protected role = new Role(this, `emx-role`, {
    roleName: `EmxEntitlementGrant-EMX-Role-${this.props.accountId}-${this.props.streamIdentifier}`,
    assumedBy: new ServicePrincipal("mediaconnect.amazonaws.com"),
    description: "media connect secret role",
  });

  protected emxOutput = new CfnFlowEntitlement(this, "source-output", {
    flowArn: this.props.emxFlow.attrFlowArn,
    description: `Entitlement to Account ${this.props.accountId}`,
    name: `${this.props.accountId}-${this.props.streamIdentifier}-emx-entitlement`,
    subscribers: [this.props.accountId],
    encryption: {
      roleArn: this.role.roleArn,
      algorithm: this.props.algorithm.toLowerCase(),
      secretArn: this.secretsManager.secretArn,
    },
  });

  automaticAlerting() {
    const topic = new Topic(this, "notification-topic", {
      enforceSSL: true
    });

    // CloudTrail needs to be enabled for this to be used
    const event = new Rule(this, "rule", {
      eventPattern: {
        source: ["aws.secretsmanager"],
        detailType: ["AWS API Call via CloudTrail"],
        detail: {
          eventSource: ["secretsmanager.amazonaws.com"],
          eventName: ["PutSecretValue", "UpdateSecret", "RotationSucceeded"],
          responseElements: {
            arn: [this.secretsManager.secretArn]
          }
        }
      }
    });
    
    // Allow Topic subscribable from consumer account
    topic.addToResourcePolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      principals: [new AccountPrincipal(this.props.accountId)],
      actions: ["sns:Subscribe"],
      resources: ["*"]
    }));
    
    event.addTarget(new SnsTopic(topic));

    new CfnOutput(this, `${this.props.accountId}-${this.props.streamIdentifier}-emx-alerter-topic-output`, {
      value: topic.topicArn,
    });

    NagSuppressions.addResourceSuppressions(topic, [
      { id: 'AwsSolutions-SNS2', reason: 'SNS does not have encryption enabled, for production workloads you may want to investigate enabling it.' },
    ]);
    NagSuppressions.addResourceSuppressions(topic, [
      { id: 'AwsSolutions-SNS3', reason: 'SNS does not have encryption enabled, for production workloads you may want to investigate enabling it.' },
    ]);
  }
  
  public outputs = [
    new CfnOutput(this, `${this.props.accountId}-${this.props.streamIdentifier}-emx-secret-output`, {
      value: this.secretsManager.secretName,
    }),
    new CfnOutput(this, `${this.props.accountId}-${this.props.streamIdentifier}-emx-secret-arn-output`, {
      exportName: `${this.props.accountId}-${this.props.streamIdentifier}-emx-secret-arn-output`,
      value: this.secretsManager.secretArn,
    }),
  ];
}
