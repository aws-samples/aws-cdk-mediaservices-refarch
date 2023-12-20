/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */

import {
  Aws,
  aws_iam as iam,
  Fn,
  aws_mediapackagev2 as mediapackagev2,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import { ExtraAttributes } from "./custom_ressources/mediapackage-extra-attributes";
import { NagSuppressions } from "cdk-nag";

interface MediaPackageParameterReaderProps {
  ad_markers: string;
  hls_segment_duration_seconds: number;
  hls_playlist_window_seconds: number;
  hls_include_I_frame: boolean;
  hls_audio_rendition_group: boolean;
  hls_startover_window_seconds: number;
  hls_program_date_interval: number;
  cmaf_segment_duration_seconds: number;
  cmaf_include_I_frame: boolean;
  cmaf_program_date_interval: number;
  cmaf_playlist_window_seconds: number;
  cmaf_startover_window_seconds: number;
}

export class MediaPackageV2 extends Construct {
  public readonly myChannel: mediapackagev2.CfnChannel;
  public readonly myChannelEndpointHls: mediapackagev2.CfnOriginEndpoint;
  public readonly myChannelEndpointCmaf: mediapackagev2.CfnOriginEndpoint;
  public readonly myChannelEndpointHlsUrl: string;
  public readonly myChannelEndpointCmafUrl: string;
  public readonly myChannelEndpointLlHlsUrl: string;
  public readonly myChannelEndpointLlCmafUrl: string;
  public readonly myChannelIngestEndpoint1: string;
  public readonly myChannelIngestEndpoint2: string;
  public readonly myChannelGroupName: string;
  public readonly myChannelName: string;

  constructor(
    scope: Construct,
    id: string,
    configuration: MediaPackageParameterReaderProps,
  ) {
    super(scope, id);
    this.myChannelGroupName = Aws.STACK_NAME;
    this.myChannelName = "Channel1";
    const hlsOriginEndpointName = "ts";
    const cmafOriginEndpointName = "cmaf";
    const multiVariantManifestName = "master";
    const lowLatencyMultiVariantManifestName = "ll-master";
    const variantManifestName = "variant";
    const lowLatencyVariantManifestName = "ll-variant";
    const segmentName = "segment";

    const adTrigger = [
      "SPLICE_INSERT",
      "PROGRAM",
      "BREAK",
      "DISTRIBUTOR_ADVERTISEMENT",
      "DISTRIBUTOR_OVERLAY_PLACEMENT_OPPORTUNITY",
      "DISTRIBUTOR_PLACEMENT_OPPORTUNITY",
      "PROVIDER_ADVERTISEMENT",
      "PROVIDER_OVERLAY_PLACEMENT_OPPORTUNITY",
      "PROVIDER_PLACEMENT_OPPORTUNITY",
      "SPLICE_INSERT",
    ];

    /*
     * First step: Create MediaPackage Channel Group👇
     */
    const channelGroup = new mediapackagev2.CfnChannelGroup(
      this,
      "MyCdkChannelGroup",
      {
        channelGroupName: this.myChannelGroupName,
        description: "Channel Group for " + Aws.STACK_NAME,
      },
    );

    /*
     * Second step: Create MediaPackage Channel and Endpoints 👇
     */
    //👇 Creating MediaPackage channel
    this.myChannel = new mediapackagev2.CfnChannel(this, "MyCfnChannel", {
      channelName: this.myChannelName,
      channelGroupName: channelGroup.channelGroupName,
      description: "Channel for " + Aws.STACK_NAME,
    });
    this.myChannel.addDependency(channelGroup);

    // Create HLS origin endpoint
    const hlsEndpoint = new mediapackagev2.CfnOriginEndpoint(
      this,
      "HlsEndpoint",
      {
        originEndpointName: hlsOriginEndpointName,
        channelGroupName: this.myChannelGroupName,
        channelName: this.myChannelName,
        containerType: "TS",
        description: "HLS/TS Origin Endpoint",
        hlsManifests: [
          {
            manifestName: multiVariantManifestName,
            childManifestName: variantManifestName,
            manifestWindowSeconds: configuration["hls_playlist_window_seconds"],
            programDateTimeIntervalSeconds:
              configuration["hls_program_date_interval"],
            scteHls: {
              adMarkerHls: configuration["ad_markers"],
            },
          },
        ],
        lowLatencyHlsManifests: [
          {
            manifestName: lowLatencyMultiVariantManifestName,
            childManifestName: lowLatencyVariantManifestName,
            manifestWindowSeconds: configuration["hls_playlist_window_seconds"],
            programDateTimeIntervalSeconds:
              configuration["hls_program_date_interval"],
            scteHls: {
              adMarkerHls: configuration["ad_markers"],
            },
          },
        ],
        segment: {
          includeIframeOnlyStreams: configuration["hls_include_I_frame"],
          scte: {
            scteFilter: adTrigger,
          },
          segmentDurationSeconds: configuration["hls_segment_duration_seconds"],
          segmentName: segmentName,
          tsIncludeDvbSubtitles: true,
          tsUseAudioRenditionGroup: configuration["hls_audio_rendition_group"],
        },
        startoverWindowSeconds: configuration["hls_startover_window_seconds"],
      },
    );
    hlsEndpoint.addDependency(this.myChannel);

    // Create CMAF origin endpoint
    const cmafEndpoint = new mediapackagev2.CfnOriginEndpoint(
      this,
      "OriginEndpointCmaf",
      {
        originEndpointName: cmafOriginEndpointName,
        channelGroupName: this.myChannel.channelGroupName,
        channelName: this.myChannel.channelName,
        containerType: "CMAF",
        description: "CMAF Origin Endpoint description",
        hlsManifests: [
          {
            manifestName: multiVariantManifestName,
            childManifestName: variantManifestName,
            manifestWindowSeconds:
              configuration["cmaf_playlist_window_seconds"],
            programDateTimeIntervalSeconds:
              configuration["cmaf_program_date_interval"],
            scteHls: {
              adMarkerHls: configuration["ad_markers"],
            },
          },
        ],
        lowLatencyHlsManifests: [
          {
            manifestName: lowLatencyMultiVariantManifestName,
            childManifestName: lowLatencyVariantManifestName,
            manifestWindowSeconds:
              configuration["cmaf_playlist_window_seconds"],
            programDateTimeIntervalSeconds:
              configuration["cmaf_program_date_interval"],
            scteHls: {
              adMarkerHls: configuration["ad_markers"],
            },
          },
        ],
        segment: {
          includeIframeOnlyStreams: configuration["cmaf_include_I_frame"],
          scte: {
            scteFilter: adTrigger,
          },
          segmentDurationSeconds:
            configuration["cmaf_segment_duration_seconds"],
          segmentName: segmentName,
          tsIncludeDvbSubtitles: false,
          tsUseAudioRenditionGroup: false,
        },
        startoverWindowSeconds: configuration["cmaf_startover_window_seconds"],
      },
    );
    cmafEndpoint.addDependency(this.myChannel);

    // Attach policy to origin endpoints
    // TODO: Currently these policies are public but should be restricted to the CloudFront Distribution.
    // This can only be implemented once CloudFront supports SigV4 for MediaPackage origins
    const hlsOriginEndpointPolicy = new mediapackagev2.CfnOriginEndpointPolicy(
      this,
      "HlsOriginEndpointPolicy",
      {
        channelName: this.myChannelName,
        channelGroupName: this.myChannelGroupName,
        originEndpointName: hlsOriginEndpointName,
        policy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              sid: "AllowUser",
              effect: iam.Effect.ALLOW,
              actions: ["mediapackagev2:GetObject"],
              principals: [new iam.AnyPrincipal()],
              resources: [hlsEndpoint.attrArn],
            }),
          ],
        }),
      },
    );
    hlsOriginEndpointPolicy.addDependency(hlsEndpoint);

    const cmafOriginEndpointPolicy = new mediapackagev2.CfnOriginEndpointPolicy(
      this,
      "CmafOriginEndpointPolicy",
      {
        channelName: this.myChannelName,
        channelGroupName: this.myChannelGroupName,
        originEndpointName: cmafOriginEndpointName,
        policy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              sid: "AllowUser",
              effect: iam.Effect.ALLOW,
              actions: ["mediapackagev2:GetObject"],
              principals: [new iam.AnyPrincipal()],
              resources: [cmafEndpoint.attrArn],
            }),
          ],
        }),
      },
    );
    cmafOriginEndpointPolicy.addDependency(cmafEndpoint);

    /*
     * Final step: Export Varibales  👇
     */
    this.myChannelEndpointHls = hlsEndpoint;
    this.myChannelEndpointCmaf = cmafEndpoint;

    const extraAttributes = new ExtraAttributes(this, "ExtraAttributes", {
      channelGroupName: this.myChannelGroupName,
      channelName: this.myChannelName,
    });
    extraAttributes.node.addDependency(this.myChannel);
    this.myChannelIngestEndpoint1 = extraAttributes.channelIngestEndpoint1;
    this.myChannelIngestEndpoint2 = extraAttributes.channelIngestEndpoint2;

    // HLS Output
    const hlsManifestName = Fn.join("", [multiVariantManifestName, ".m3u8"]);
    this.myChannelEndpointHlsUrl = Fn.join("/", [
      "https:/",
      channelGroup.attrEgressDomain,
      "out/v1",
      this.myChannelGroupName,
      this.myChannelName,
      hlsOriginEndpointName,
      hlsManifestName,
    ]);

    // Low Latency HLS Output
    const llHlsManifestName = Fn.join("", [
      lowLatencyMultiVariantManifestName,
      ".m3u8",
    ]);
    this.myChannelEndpointLlHlsUrl = Fn.join("/", [
      "https:/",
      channelGroup.attrEgressDomain,
      "out/v1",
      this.myChannelGroupName,
      this.myChannelName,
      hlsOriginEndpointName,
      llHlsManifestName,
    ]);

    // CMAF Output
    const cmafManifestName = Fn.join("", [multiVariantManifestName, ".m3u8"]);
    this.myChannelEndpointCmafUrl = Fn.join("/", [
      "https:/",
      channelGroup.attrEgressDomain,
      "out/v1",
      this.myChannelGroupName,
      this.myChannelName,
      cmafOriginEndpointName,
      cmafManifestName,
    ]);

    // Low Latency CMAF Output
    const llCmafManifestName = Fn.join("", [
      lowLatencyMultiVariantManifestName,
      ".m3u8",
    ]);
    this.myChannelEndpointLlCmafUrl = Fn.join("/", [
      "https:/",
      channelGroup.attrEgressDomain,
      "out/v1",
      this.myChannelGroupName,
      this.myChannelName,
      cmafOriginEndpointName,
      llCmafManifestName,
    ]);
  }

  // Channel Policy can only be created once the MediaLive Role has been created
  attachChannelPolicy(mediaLiveRoleArn: string) {
    // Create MediaPackage Channel policy
    const myChannelPolicy = new mediapackagev2.CfnChannelPolicy(
      this,
      "MyCfnChannelPolicy",
      {
        channelName: this.myChannelName,
        channelGroupName: this.myChannelGroupName,
        policy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              sid: "AllowMediaLiveChannelToIngestToEmpChannel",
              effect: iam.Effect.ALLOW,
              actions: ["mediapackagev2:PutObject"],
              principals: [new iam.ArnPrincipal(mediaLiveRoleArn)],
              resources: [this.myChannel.attrArn],
            }),
          ],
        }),
      },
    );
    myChannelPolicy.addDependency(this.myChannel);
  }
}
