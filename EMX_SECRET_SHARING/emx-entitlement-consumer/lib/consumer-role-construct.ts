import { CfnOutput } from "aws-cdk-lib";
import { Role, ServicePrincipal, ManagedPolicy } from "aws-cdk-lib/aws-iam";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";

/**
 * This construct needs to be deployed first but a "consumer"
 * It provides mainly a role that will need to be provided back to the "supplier" so that it is able to assume a role in their account.
 *
 * Without this Construct, the consumable role in the "granting" account will be open to the consumer whole account which is not least privilage.
 */
export class EmxEntitlementConsumerRole extends Construct {
    constructor(scope: Construct) {
      super(scope, "entitlement");
  
      NagSuppressions.addResourceSuppressions(this.role, [
        { id: 'AwsSolutions-IAM4', reason: 'Lambda execution role to get stats on execution.' },
      ]);
    }
  
    public role = new Role(this, "fn-role", {
      assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [ManagedPolicy.fromManagedPolicyArn(this, "write", "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole")],
    });
  
    public outputs = [
      new CfnOutput(this, "consumer-role-output", {
        value: this.role.roleArn,
        exportName: "consumer-role-arn-output",
        description: "Send this Role ARN to the supplier of your Elemental MediaConnect Output Flow.",
      }),
    ];
  }
  