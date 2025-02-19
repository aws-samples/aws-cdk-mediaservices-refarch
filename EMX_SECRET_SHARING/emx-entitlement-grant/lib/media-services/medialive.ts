import { CfnOutput, Stack } from "aws-cdk-lib";
import { Role, ServicePrincipal, PolicyStatement, Effect, PolicyDocument } from "aws-cdk-lib/aws-iam";
import { CfnChannel, CfnInput } from "aws-cdk-lib/aws-medialive";
import { NagSuppressions } from "cdk-nag";
import { AudioAAC } from "../encoder-settings/audio";
import { UdpOutput } from "../encoder-settings/output";
import { UdpOutputGroupSettings } from "../encoder-settings/output-group-settings";
import { VideoH264 } from "../encoder-settings/video";
import { CfnFlow } from "aws-cdk-lib/aws-mediaconnect";

// https://docs.aws.amazon.com/medialive/latest/ug/emx-upstream.html
export function createMediaLiveInput(stack: Stack, url: string): CfnInput {
  const input = new CfnInput(stack, `file-input`, {
    type: "MP4_FILE",
    name: `EMXSecretSharePoC-grant-file-input`,
    sources: [{
        url
    }],
  });

  new CfnOutput(stack, "eml-content-input-id", {
    value: input.ref,
    exportName: `${stack.stackName}-eml-channel-input-id`,
  });

  return input;
}

export function createMediaLiveRole(stack: Stack, id: string): Role {
  const role = new Role(stack, `media-live-s3-role-${id}`, {
    assumedBy: new ServicePrincipal("medialive.amazonaws.com"),
    inlinePolicies: {
      inline: new PolicyDocument({
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
              "s3:*"
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
      reason: "Policy required for MediaLive.",
      appliesTo: ["Resource::*", "Action::s3:*"],
    },
  ]);

  return role;
}

interface IMediaLiveProps {
  input: CfnInput;
  output: CfnFlow;
}

export function createMediaLive(stack: Stack, props: IMediaLiveProps): CfnChannel {
  const { input, output } = props;

  const audioSettings = new AudioAAC("myMainAudio");
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

  const outputSettingsUdp1 = new UdpOutput("output1", HDVideoSettings.getUniqueId(), audioSettings.getUniqueId());

  const channel = new CfnChannel(stack, "live-eml-channel", {
    name: `EMXSecretSharePoC-grant-live-input`,
    roleArn: createMediaLiveRole(stack, "channel").roleArn,
    encoderSettings: {
      globalConfiguration: {
        inputEndAction: "SWITCH_AND_LOOP_INPUTS",
        outputTimingSource: "SYSTEM_CLOCK",
      },
      audioDescriptions: [audioSettings.getAudioProfile()],
      captionDescriptions: [],
      outputGroups: [
        {
          outputGroupSettings: new UdpOutputGroupSettings().getOutputGroupSettings(),
          outputs: [outputSettingsUdp1.getOutputSettings()],
        },
      ],
      timecodeConfig: {
        source: "SYSTEMCLOCK",
      },
      videoDescriptions: [HDVideoSettings.getVideoProfile()],
    },
    channelClass: "SINGLE_PIPELINE",
    inputSpecification: {
      codec: "AVC",
      resolution: "HD",
      maximumBitrate: "MAX_10_MBPS",
    },
    destinations: [
      {
        id: outputSettingsUdp1.getUniqueId(),
        settings: [{
            url: `rtp://${output.attrSourceIngestIp}:${output.attrSourceSourceIngestPort}`,
        }]
      },
    ],
    inputAttachments: [
      {
        inputAttachmentName: `input-${input.ref}`,
        inputId: input.ref,
        inputSettings: {
          sourceEndBehavior: "LOOP",
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
  });

  new CfnOutput(stack, "eml-channel-id-output", {
    exportName: `${stack.stackName}-eml-channel-id-output`,
    value: channel.ref,
  });

  return channel;
}
