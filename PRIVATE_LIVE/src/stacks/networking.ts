import { App, Stack } from "aws-cdk-lib";
import { STACK_PREFIX_NAME } from "..";
import { AVAILABILITY_ZONES } from "../config";
import { createVpc } from "../vpc";

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

export function createNetworkStack(app: App): INetworkStackOutputs {
  const stack = new OverriddenStack(app, `${STACK_PREFIX_NAME}-private-network-stack`, {
    env: {
      region: process.env.CDK_DEFAULT_REGION,
      account: process.env.CDK_DEFAULT_ACCOUNT,
    },
    description: "AWS CDK MediaServices Reference Architectures: Private Network video workflow. Stack contains VPC networking.",
  });

  createVpc(stack);

  return {
    stack,
    tags: {
      "private-networking-stack-name": `${STACK_PREFIX_NAME}-private-network-stack`,
      "used-in-private-networking-media-stack": "true",
    },
  };
}
