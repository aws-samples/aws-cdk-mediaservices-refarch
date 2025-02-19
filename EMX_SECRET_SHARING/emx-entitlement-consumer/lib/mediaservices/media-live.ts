import { CfnOutput, Fn, Stack } from "aws-cdk-lib";
import { Role, ServicePrincipal, PolicyStatement, Effect, PolicyDocument } from "aws-cdk-lib/aws-iam";
import { CfnChannel, CfnInput } from "aws-cdk-lib/aws-medialive";
import { CfnChannel as MPCfnChannel } from "aws-cdk-lib/aws-mediapackagev2";
import { NagSuppressions } from "cdk-nag";
import { AudioAAC } from "../encoder-settings/audio";
import { MpOutput } from "../encoder-settings/output";
import { MPOutputGroupSettings } from "../encoder-settings/output-group-settings";
import { VideoH264 } from "../encoder-settings/video";
import { STACK_PREFIX_NAME } from "..";


// https://docs.aws.amazon.com/medialive/latest/ug/emx-upstream.html
export function createMediaLiveInput(stack: Stack, mcFlow1a: string): CfnInput {
  const role = createMediaLiveRole(stack, `connect`);

  const input = new CfnInput(stack, `live-input`, {
    type: "MEDIACONNECT",
    name: `${STACK_PREFIX_NAME}-entitled-input`,
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
              "s3:*",
              "mediapackagev2:PutObject",
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
  mediaPackageChannel: MPCfnChannel;
}

export function createMediaLive(stack: Stack, props: IMediaLiveProps): CfnChannel {
  const { input, mediaPackageChannel } = props;

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

  const output1 = new MpOutput("output1", "video-1080", {videoSettings: HDVideoSettings.getUniqueId()});
  const output2 = new MpOutput("output2", "audio-aac", {audioSettings: audioSettings.getUniqueId()});

  const outputSettings = new MPOutputGroupSettings("cmaf-destination");

  // Single pipeline channel
  const url1 = Fn.select(
    0,
    mediaPackageChannel.attrIngestEndpointUrls,
  );
  
  const channel = new CfnChannel(stack, "live-eml-channel", {
    name: `${STACK_PREFIX_NAME}-entitled-channel`,
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
          outputGroupSettings: outputSettings.getOutputGroupSettings(),
          outputs: [output1.getOutputSettings(), output2.getOutputSettings()],
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
      maximumBitrate: "MAX_20_MBPS",
    },
    destinations: [
      {
        id: "cmaf-destination",
        settings: [{
          url: url1,
        }]
      }
    ],
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
  });

  new CfnOutput(stack, "eml-channel-id-output", {
    exportName: `${stack.stackName}-eml-channel-id-output`,
    value: channel.ref,
  });

  return channel;
}
