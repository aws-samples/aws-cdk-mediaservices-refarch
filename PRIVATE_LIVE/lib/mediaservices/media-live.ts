import { CfnOutput, Stack } from "aws-cdk-lib";
import { SubnetType, Vpc } from "aws-cdk-lib/aws-ec2";
import { Role, ServicePrincipal, PolicyStatement, Effect, PolicyDocument } from "aws-cdk-lib/aws-iam";
import { CfnChannel, CfnInput } from "aws-cdk-lib/aws-medialive";
import { NagSuppressions } from "cdk-nag";
import { STACK_PREFIX_NAME } from "../../bin";
import { MEDIA_LIVE_OUTPUT_TARGET } from "../config";
import { AudioAAC } from "../encoder-settings/audio";
import { VideoH264 } from "../encoder-settings/video";
import { OutputGroups } from "../encoder-settings/output";
import { IVpcTags } from "../stacks/networking";
import { MSSOutputGroupSettings } from "../encoder-settings/output-group-settings";

// https://docs.aws.amazon.com/medialive/latest/ug/emx-upstream.html
export function createMediaLiveInput(stack: Stack, mcFlow1a: string): CfnInput {
  const role = createMediaLiveRole(stack, "connect");

  const input = new CfnInput(stack, `eml-live-input`, {
    name: `${stack.stackName}-EML-live-input`,
    type: "MEDIACONNECT",
    roleArn: role.roleArn,
    mediaConnectFlows: [
      {
        flowArn: mcFlow1a,
      },
    ],
  });
  input.node.addDependency(role);

  new CfnOutput(stack, "eml-content-input-id", {
    value: input.ref,
    exportName: `${stack.stackName}-eml-channel-input-id`,
  });

  return input;
}

export function createMediaLiveRole(stack: Stack, id: string): Role {
  const role = new Role(stack, `eml-role-${id}`, {
    roleName: `${stack.stackName}-EML-${id}-role`,
    assumedBy: new ServicePrincipal("medialive.amazonaws.com"),
    inlinePolicies: {
      default: new PolicyDocument({
        statements: [
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: [
              "ec2:DescribeAddresses",
              "mediaconnect:AddFlowOutputs",
              "mediaconnect:ManagedDescribeFlow",
              "ec2:DeleteNetworkInterfacePermission",
              "ec2:DescribeNetworkInterfaces",
              "ec2:CreateNetworkInterfacePermission",
              "mediastore:DeleteObject",
              "mediastore:DescribeObject",
              "mediapackage:DescribeChannel",
              "mediastore:ListContainers",
              "ec2:DeleteNetworkInterface",
              "mediastore:GetObject",
              "mediaconnect:ManagedRemoveOutput",
              "mediaconnect:RemoveFlowOutput",
              "ec2:DescribeSecurityGroups",
              "ec2:CreateNetworkInterface",
              "mediaconnect:DescribeFlow",
              "ec2:DescribeSubnets",
              "ec2:AssociateAddress",
              "mediastore:PutObject",
              "mediaconnect:ManagedAddOutput",
            ],
            resources: ["*"],
          }),
        ],
      }),
    },
  });
  NagSuppressions.addResourceSuppressions(role, [
    {
      id: "AwsSolutions-IAM5",
      reason: "Policy required for Elemental MediaLive Usage.",
      appliesTo: ["Resource::*"],
    },
  ]);
  return role;
}

interface IMediaLiveProps {
  input: CfnInput;
  tags: IVpcTags;
}

export function createMediaLive(stack: Stack, props: IMediaLiveProps): CfnChannel {
  const { input, tags } = props;

  const vpc = Vpc.fromLookup(stack, "eml-vpc-import", {
    isDefault: false,
    tags,
  });

  const privateSubnet1a = vpc.selectSubnets({ subnetType: SubnetType.PRIVATE_WITH_EGRESS, availabilityZones: ["eu-west-1a"] }).subnetIds[0];

  const audioSettings = new AudioAAC("myMainAudio");
  const videoSettings = new VideoH264(
    "HDVideo",
    {
      height: 1080,
      width: 1920,
    },
    {
      bitrate: 5000000,
    },
  );

  const outputSettings = new OutputGroups("output1", videoSettings.getUniqueId(), audioSettings.getUniqueId());
  const mssOutputGroupSettings = new MSSOutputGroupSettings(outputSettings.getUniqueId());

  const channel = new CfnChannel(stack, "eml-private-networking-channel", {
    name: `${STACK_PREFIX_NAME}-eml-private-networking-channel`,
    roleArn: createMediaLiveRole(stack, "channel").roleArn,
    vpc: {
      subnetIds: [privateSubnet1a],
    },
    encoderSettings: {
      globalConfiguration: {
        inputEndAction: "SWITCH_AND_LOOP_INPUTS",
      },
      audioDescriptions: [audioSettings.getAudioProfile()],
      captionDescriptions: [],
      outputGroups: [
        {
          outputGroupSettings: mssOutputGroupSettings.getOutputGroupSettings(),
          outputs: [outputSettings.getOutputSettings()],
        },
      ],
      timecodeConfig: {
        source: "EMBEDDED",
      },
      videoDescriptions: [videoSettings.getVideoProfile()],
    },
    channelClass: "SINGLE_PIPELINE",
    inputSpecification: {
      codec: "AVC",
      resolution: "HD",
      maximumBitrate: "MAX_20_MBPS",
    },
    inputAttachments: [
      {
        inputAttachmentName: `input-${input.ref}`,
        inputId: input.ref,
        inputSettings: {
          sourceEndBehavior: "CONTINUE",
          inputFilter: "AUTO",
          filterStrength: 1,
          deblockFilter: "DISABLED",
          denoiseFilter: "DISABLED",
          smpte2038DataPreference: "IGNORE",
          audioSelectors: [],
          captionSelectors: [],
        },
      },
    ],
    destinations: [
      {
        id: outputSettings.getUniqueId(),
        settings: [
          {
            url: MEDIA_LIVE_OUTPUT_TARGET,
          },
        ],
        mediaPackageSettings: [],
      },
    ],
  });

  new CfnOutput(stack, "eml-channel-id-output", {
    exportName: `${stack.stackName}-eml-channel-id-output`,
    value: channel.ref,
  });

  return channel;
}
