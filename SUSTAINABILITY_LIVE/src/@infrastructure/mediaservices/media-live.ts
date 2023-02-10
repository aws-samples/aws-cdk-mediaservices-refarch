import { CfnOutput, Stack } from "aws-cdk-lib";
import { Role, ServicePrincipal, PolicyStatement, Effect, PolicyDocument } from "aws-cdk-lib/aws-iam";
import { CfnChannel, CfnInput } from "aws-cdk-lib/aws-medialive";
import { CfnChannel as MPCfnChannel } from "aws-cdk-lib/aws-mediapackage";
import { INPUT_BUCKET_MP4_FILE, INPUT_BUCKET_NAME } from "../../config";
import { AudioAAC } from "../encoder-settings/audio";
import { MpOutput, UdpOutput } from "../encoder-settings/output";
import { MPOutputGroupSettings, UDPOutputGroupSettings } from "../encoder-settings/output-group-settings";
import { VideoH264 } from "../encoder-settings/video";
import { NagSuppressions } from "cdk-nag";

export function createMediaLiveInput(stack: Stack, bucketName: string, asset: string) {
  // https://docs.aws.amazon.com/medialive/latest/ug/mp4-upstream.html
  const input = new CfnInput(stack, "eml-vod-input", {
    type: "MP4_FILE",
    name: `${stack.stackName}-EML-input`,
    sources: [
      {
        url: `s3ssl://${bucketName}/${asset}`,
      },
    ],
  });

  new CfnOutput(stack, "eml-content-input", {
    value: input.ref,
    exportName: "eml-channel-input-id",
  });

  return input;
}

export function createMediaLiveRole(stack: Stack): Role {
  const role = new Role(stack, "media-live-s3-role", {
    roleName: `${stack.stackName}-EML-role`,
    assumedBy: new ServicePrincipal("medialive.amazonaws.com"),
    inlinePolicies: {
      policy: new PolicyDocument({
        statements: [
          new PolicyStatement({
            actions: ["s3:GetObject"],
            resources: [`arn:aws:s3:::${INPUT_BUCKET_NAME}/${INPUT_BUCKET_MP4_FILE}`],
            effect: Effect.ALLOW,
          }),
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
  return role;
}

interface IMediaLiveProps {
  mp: MPCfnChannel;
  input: CfnInput;
  mxIP: string;
  mxPort: string;
}

export function createMediaLive(stack: Stack, props: IMediaLiveProps): CfnChannel {
  const { mp, mxIP, mxPort, input } = props;

  const HDVideoSettings = new VideoH264(
    "HDVideo",
    {
      height: 1080,
      width: 1920,
    },
    {
      bitrate: 6000000,
    },
  );

  const SDVideoSettings = new VideoH264(
    "SDVideo",
    {
      height: 720,
      width: 1280,
    },
    {
      bitrate: 4000000,
    },
  );

  const lowestVideoSettings = new VideoH264(
    "LowestVideo",
    {
      height: 360,
      width: 640,
    },
    {
      bitrate: 700000,
    },
  );
  const audioSettings = new AudioAAC("myMainAudio");

  const output = new MPOutputGroupSettings(mp);
  const outputSettingsMp1 = new MpOutput("mpoutput1", HDVideoSettings.getUniqueId(), audioSettings.getUniqueId());
  const outputSettingsMp2 = new MpOutput("mpoutput2", SDVideoSettings.getUniqueId(), audioSettings.getUniqueId());
  const outputSettingsMp3 = new MpOutput("mpoutput3", lowestVideoSettings.getUniqueId(), audioSettings.getUniqueId());

  const outputUdp = new UDPOutputGroupSettings();
  const outputSettingsUdp = new UdpOutput("output1", HDVideoSettings.getUniqueId(), audioSettings.getUniqueId());

  const mediaLiveRole = createMediaLiveRole(stack);
  NagSuppressions.addResourceSuppressions(mediaLiveRole, [
    {
      id: "AwsSolutions-IAM5",
      reason: "Policy required for MediaLive.",
      appliesTo: ["Resource::*"],
    },
  ]);

  const channel = new CfnChannel(stack, "sustainable-eml-channel", {
    name: `${stack.stackName}-EML-channel`,
    roleArn: mediaLiveRole.roleArn,
    encoderSettings: {
      globalConfiguration: {
        inputEndAction: "SWITCH_AND_LOOP_INPUTS",
      },
      audioDescriptions: [audioSettings.getAudioProfile()],
      captionDescriptions: [],
      outputGroups: [
        {
          outputGroupSettings: output.getOutputGroupSettings(),
          outputs: [outputSettingsMp1.getOutputSettings(), outputSettingsMp2.getOutputSettings(), outputSettingsMp3.getOutputSettings()],
        },
        {
          outputGroupSettings: outputUdp.getOutputGroupSettings(),
          outputs: [outputSettingsUdp.getOutputSettings()],
        },
      ],
      timecodeConfig: {
        source: "EMBEDDED",
      },
      videoDescriptions: [HDVideoSettings.getVideoProfile(), SDVideoSettings.getVideoProfile(), lowestVideoSettings.getVideoProfile()],
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
      {
        id: outputSettingsUdp.getUniqueId(),
        settings: [
          {
            url: `rtp://${mxIP}:${mxPort}`,
          },
        ],
      },
    ],
  });

  new CfnOutput(stack, "eml-channel-output", {
    exportName: "eml-channel-output",
    value: channel.ref,
  });

  return channel;
}
