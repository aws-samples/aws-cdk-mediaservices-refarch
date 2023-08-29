import { Aspects, CfnOutput, RemovalPolicy, Stack, Tag } from "aws-cdk-lib";
import { FlowLogDestination, IpAddresses, SubnetType, Vpc } from "aws-cdk-lib/aws-ec2";
import { Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { LogGroup } from "aws-cdk-lib/aws-logs";
import { STACK_PREFIX_NAME } from "../bin/";
import { AVAILABILITY_ZONES, VPC_CIDR } from "./config";

export function createVpc(stack: Stack) {
  const logGroup = new LogGroup(stack, "vpc-loggroup", {
    removalPolicy: RemovalPolicy.DESTROY,
    logGroupName: `${STACK_PREFIX_NAME}-private-networking-vpc-loggroup`,
  });
  const role = new Role(stack, "vpc-flowlogs-role", {
    assumedBy: new ServicePrincipal("vpc-flow-logs.amazonaws.com"),
    roleName: `${STACK_PREFIX_NAME}-private-networking-vpc-flowlogs-role`,
  });

  const vpc = new Vpc(stack, "vpc", {
    vpcName: `${STACK_PREFIX_NAME}-private-networking-vpc`,
    availabilityZones: AVAILABILITY_ZONES,
    ipAddresses: IpAddresses.cidr(VPC_CIDR),
    natGateways: 1,
    subnetConfiguration: [
      {
        name: "workflow",
        subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        cidrMask: 28,
      },
      {
        name: "public",
        subnetType: SubnetType.PUBLIC,
        cidrMask: 28,
      },
    ],
  });

  vpc.addFlowLog("vpc-cloudwatch", {
    destination: FlowLogDestination.toCloudWatchLogs(logGroup, role),
  });

  Aspects.of(vpc).add(new Tag("private-networking-stack-name", `${STACK_PREFIX_NAME}-private-network-stack`));
  Aspects.of(vpc).add(new Tag("used-in-private-networking-media-stack", "true"));

  new CfnOutput(stack, "vpc-id-output", {
    value: vpc.vpcId,
    exportName: `${stack.stackName}-vpc-id-output`,
  });
  new CfnOutput(stack, "vpc-subnets-pri-output", {
    value: vpc.selectSubnets({ subnetType: SubnetType.PRIVATE_WITH_EGRESS }).subnetIds.toString(),
    exportName: `${stack.stackName}-vpc-pri-subnet-output`,
  });
  new CfnOutput(stack, "vpc-subnets-pub-output", {
    value: vpc.selectSubnets({ subnetType: SubnetType.PUBLIC }).subnetIds.toString(),
    exportName: `${stack.stackName}-vpc-pub-subnet-output`,
  });

  return vpc;
}
