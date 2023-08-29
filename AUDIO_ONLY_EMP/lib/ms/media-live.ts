import { CfnOutput, Stack } from "aws-cdk-lib";
import { Role, ServicePrincipal, PolicyStatement, Effect, PolicyDocument } from "aws-cdk-lib/aws-iam";
import { CfnChannel, CfnInput } from "aws-cdk-lib/aws-medialive";
import { AudioAAC } from "../encoder-settings/audio";
import { MpOutput } from "../encoder-settings/output";
import { MPOutputGroupSettings } from "../encoder-settings/output-group-settings";
import { CfnChannel as MpCfnChannel } from "aws-cdk-lib/aws-mediapackage";
import { VideoH264 } from "../encoder-settings/video";
import { STACK_PREFIX_NAME } from "../../bin";
import { NagSuppressions } from "cdk-nag";

// https://docs.aws.amazon.com/medialive/latest/ug/emx-upstream.html
export function createMediaLiveInput(stack: Stack, mcFlow1a: string): CfnInput {
  const role = createMediaLiveRole(stack, "emx");

  const input = new CfnInput(stack, `live-input`, {
    type: "MEDIACONNECT",
    name: `${STACK_PREFIX_NAME}-EML-ao-input`,
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
    exportName: `${STACK_PREFIX_NAME}-eml-channel-input-id`,
  });

  return input;
}

export function createMediaLiveRole(stack: Stack, id: string): Role {
  const role = new Role(stack, `media-live-s3-role-${id}`, {
    roleName: `${stack.stackName}-EML-role-${id}`,
    assumedBy: new ServicePrincipal("medialive.amazonaws.com"),
    inlinePolicies: {
      policy: new PolicyDocument({
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
  mp: MpCfnChannel;
}

export function createMediaLive(stack: Stack, props: IMediaLiveProps): CfnChannel {
  const { mp, input } = props;

  const audioSettings = new AudioAAC("audio1", {
    bitrate: 96000,
  });
  const audioSettings2 = new AudioAAC("audio2", {
    bitrate: 256000,
  });

  const smallMinimalVideo = new VideoH264(
    "smallMinimalVideo",
    {
      height: 32,
      width: 32,
    },
    {
      bitrate: 1000,
      framerateNumerator: 5,
      framerateDenominator: 1,
    },
  );

  const outputAudioSettingsHls = new MpOutput("output1", {
    videoSettings: undefined,
    audioSettings: [audioSettings.getUniqueId()],
  });
  const outputAudioSettingsHls2 = new MpOutput("output2", {
    videoSettings: undefined,
    audioSettings: [audioSettings2.getUniqueId()],
  });
  const outputVideoSettingsHls = new MpOutput("videooutput", {
    videoSettings: smallMinimalVideo.getUniqueId(),
    audioSettings: undefined,
  });

  const output = new MPOutputGroupSettings(mp);

  const mediaLiveRole = createMediaLiveRole(stack, "eml");

  const channel = new CfnChannel(stack, "ao-eml-channel", {
    name: `${stack.stackName}-EML-ao-channel`,
    roleArn: mediaLiveRole.roleArn,
    encoderSettings: {
      globalConfiguration: {
        inputEndAction: "NONE",
      },
      audioDescriptions: [audioSettings.getAudioProfile(), audioSettings2.getAudioProfile()],
      captionDescriptions: [],
      outputGroups: [
        {
          outputGroupSettings: output.getOutputGroupSettings(),
          outputs: [outputAudioSettingsHls.getOutputSettings(), outputAudioSettingsHls2.getOutputSettings(), outputVideoSettingsHls.getOutputSettings()],
        },
      ],
      timecodeConfig: {
        source: "EMBEDDED",
      },
      videoDescriptions: [smallMinimalVideo.getVideoProfile()],
    },
    channelClass: "SINGLE_PIPELINE",
    inputSpecification: {
      codec: "AVC",
      resolution: "SD",
      maximumBitrate: "MAX_10_MBPS",
    },
    inputAttachments: [
      {
        inputAttachmentName: `input-${input.ref}`,
        inputId: input.ref,
      },
    ],
    destinations: [
      {
        id: mp.ref,
        mediaPackageSettings: [
          {
            channelId: mp.id,
          },
        ],
      },
    ],
  });

  return channel;
}
