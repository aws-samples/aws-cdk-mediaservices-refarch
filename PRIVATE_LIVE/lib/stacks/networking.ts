import { Stack } from "aws-cdk-lib";
import { STACK_PREFIX_NAME } from "../../bin";
import { AVAILABILITY_ZONES } from "../config";
import { createVpc } from "../vpc";
import { Construct } from "constructs";

export interface IVpcTags {
  [key: string]: string;
}

export interface INetworkStackOutputs {
  stack: Stack;
  tags: IVpcTags;
}

/**
 * Workaround for https://github.com/aws/aws-cdk/issues/21690#issuecomment-1266201638
 *
 * When this is fixed, you can revert to using `Stack` and remove the hardcoding of the availability zones at a `Stack` level.
 */
export class OverriddenStack extends Stack {
  get availabilityZones() {
    return AVAILABILITY_ZONES;
  }
}

export class NetworkStack extends OverriddenStack {
  constructor(app: Construct) {
    super(app, `${STACK_PREFIX_NAME}-private-network-stack`, {
      env: {
        region: process.env.CDK_DEFAULT_REGION,
        account: process.env.CDK_DEFAULT_ACCOUNT,
      },
      description: "AWS CDK MediaServices Reference Architectures: Private Network video workflow. Stack contains VPC networking.",
    });
  }

  protected vpc = createVpc(this);

  public configuredTags = {
    "private-networking-stack-name": `${STACK_PREFIX_NAME}-private-network-stack`,
    "used-in-private-networking-media-stack": "true",
  };
}
