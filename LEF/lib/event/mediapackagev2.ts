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
  Annotations,
  aws_iam as iam,
  Fn,
  aws_mediapackagev2 as mediapackagev2,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  IMediaPackageChannelConfig,
  IMediaPackageEndpointConfig,
} from "./eventConfigInterface";

const SUPPORTED_MANIFEST_TYPE_EXTENSIONS = {
  hlsManifests: "m3u8",
  lowLatencyHlsManifests: "m3u8",
  dashManifests: "mpd",
};

export interface IMediaPackageV2Props {
  channelName: string;
  channelGroupName: string;
  configuration: IMediaPackageChannelConfig;
}

interface IManifestOutput {
  endpointReference: string;
  name: string;
  type: string;
  path: string;
}

interface IEndpointOutput {
  manifests: IManifestOutput[];
}

export class MediaPackageV2 extends Construct {
  public readonly channel: mediapackagev2.CfnChannel;
  public readonly channelEndpoints: Array<mediapackagev2.CfnOriginEndpoint> =
    [];
  public readonly channelEndpointOutputs: Array<IEndpointOutput> = [];
  public readonly channelIngestEndpoint1: string;
  public readonly channelIngestEndpoint2: string;
  public readonly channelGroupName: string;
  public readonly channelName: string;
  public readonly channelInputType: string;

  constructor(scope: Construct, id: string, props: IMediaPackageV2Props) {
    super(scope, id);
    this.channelGroupName = props.channelGroupName;
    this.channelName = props.channelName;
    this.channelInputType = props.configuration.inputType;

    /*
     * Create MediaPackage Channel
     */
    this.channel = new mediapackagev2.CfnChannel(
      this,
      "MediaPackageV2Channel",
      {
        channelName: this.channelName,
        channelGroupName: this.channelGroupName,
        description: "Channel for " + Aws.STACK_NAME,
        inputType: this.channelInputType,
      },
    );

    // Set CloudFront Distribution ARN using the CloudFront Distribution ID
    const cloudFrontDistributionId = Fn.importValue(
      this.channelGroupName + "-CloudFront-Distribution-ID",
    );
    const cloudFrontDistributionArn =
      "arn:aws:cloudfront::" +
      Aws.ACCOUNT_ID +
      ":distribution/" +
      cloudFrontDistributionId;

    // Retrieve Event Group MediaTailor Playback Configuration ARN
    const mediaTailorPlaybackConfigurationArn = Fn.importValue(
      this.channelGroupName + "-MediaTailor-Playback-Configuration-Arn",
    );

    // Define export variables for channel inputs
    this.channelIngestEndpoint1 = Fn.select(
      0,
      this.channel.attrIngestEndpointUrls,
    );
    this.channelIngestEndpoint2 = Fn.select(
      1,
      this.channel.attrIngestEndpointUrls,
    );

    /*
     * Create MediaPackage Endpoints
     */
    // Iterate over each of the endpoint configurations to create endpoint, attach policy
    // and export variables.
    for (const [endpointReference, endpointConfig] of Object.entries(
      props.configuration.endpoints,
    )) {
      // Create origin endpoint
      const endpoint = this.createOriginEndpoint(
        endpointReference,
        endpointConfig,
      );
      endpoint.addDependency(this.channel);

      // Attach policy to origin endpoint
      const policy = this.attachPolicyToOriginEndpoint(
        endpointReference + "Policy",
        endpoint,
        mediaTailorPlaybackConfigurationArn,
        cloudFrontDistributionArn,
        endpointConfig.resourcePolicyType,
      );

      // Include endpoint to be accessible from channelEndpoints member
      this.channelEndpoints.push(endpoint);

      // Define export variables for endpoint outputs
      const endpointOutputs = { manifests: Array<IManifestOutput>() };

      // Iterate over all the manifests
      for (const [manifestType, manifestExtension] of Object.entries(
        SUPPORTED_MANIFEST_TYPE_EXTENSIONS,
      )) {
        const manifests =
          endpointConfig[manifestType as keyof typeof endpointConfig];

        // Skip if no manifests of this type
        if (!manifests || !Array.isArray(manifests)) {
          continue;
        }

        // Iterate over each manifest
        for (const manifest of manifests) {
          const manifestPath = Fn.join("/", [
            "out/v1",
            this.channelGroupName,
            this.channelName,
            endpointConfig.originEndpointName,
            `${manifest.manifestName}.${manifestExtension}`,
          ]);
          endpointOutputs.manifests.push({
            endpointReference: endpointReference,
            name: manifest.manifestName,
            type: manifestType,
            path: manifestPath,
          });
        }
      }

      // Include endpoint outputs to be accessible from channelEndpointOutputs member
      this.channelEndpointOutputs.push(endpointOutputs);
    }
  }

  // Create Origin Endpoint
  createOriginEndpoint(id: string, props: IMediaPackageEndpointConfig) {
    const endpointProps: mediapackagev2.CfnOriginEndpointProps = {
      channelName: this.channelName,
      channelGroupName: this.channelGroupName,
      originEndpointName: props.originEndpointName,
      containerType: props.containerType,
      dashManifests: props.dashManifests,
      hlsManifests: props.hlsManifests,
      lowLatencyHlsManifests: props.lowLatencyHlsManifests,
      segment:
        props.segment as mediapackagev2.CfnOriginEndpoint.SegmentProperty,
      startoverWindowSeconds: props.startoverWindowSeconds,
    };

    const endpoint = new mediapackagev2.CfnOriginEndpoint(
      this,
      id,
      endpointProps,
    );

    return endpoint;
  }

  attachPolicyToOriginEndpoint(
    id: string,
    originEndpoint: mediapackagev2.CfnOriginEndpoint,
    mediaTailorPlaybackConfigurationArn: string,
    cloudFrontDistributionArn: string,
    resourcePolicyType: string,
  ) {
    // Set origin endpoint policy
    const policyStatements = [];
    if (resourcePolicyType == "PUBLIC") {
      Annotations.of(this).addWarning(
        "A public policy is being used for the " +
          "MediaPackage V2 Origin Endpoint. This allows unrestricted public " +
          "access to the endpoint and is not recommended for production workloads.",
      );

      // Use a PUBLIC policy
      policyStatements.push(
        new iam.PolicyStatement({
          sid: "AllowAllUsers",
          effect: iam.Effect.ALLOW,
          actions: ["mediapackagev2:GetObject", "mediapackagev2:GetHeadObject"],
          principals: [new iam.AnyPrincipal()],
          resources: [originEndpoint.attrArn],
        }),
      );
    } else {
      // Default to a CUSTOM policy
      policyStatements.push(
        // Policy allowing SigV4 signed requests from the 'mediaTailorPlaybackConfigurationArn'
        // MediaTailor Playback Configuration to be serviced by MediaPackage Endpoint
        new iam.PolicyStatement({
          sid: "AllowRequestsFromMediaTailorPlaybackConfiguration",
          effect: iam.Effect.ALLOW,
          actions: ["mediapackagev2:GetObject", "mediapackagev2:GetHeadObject"],
          principals: [new iam.ServicePrincipal("mediatailor.amazonaws.com")],
          resources: [originEndpoint.attrArn],
          conditions: {
            StringEquals: {
              "aws:SourceArn": [mediaTailorPlaybackConfigurationArn],
            },
          },
        }),
      );

      // Policy allowing request from the 'cloudFrontDistributionArn' CloudFront Distribution to
      // be service by MediaPackage Endpoint. For policy to work Origin Access Control policy
      // needs to be enabled on CloudFront Distribution origin.
      policyStatements.push(
        new iam.PolicyStatement({
          sid: "AllowRequestsFromCloudFront",
          effect: iam.Effect.ALLOW,
          actions: ["mediapackagev2:GetObject", "mediapackagev2:GetHeadObject"],
          principals: [new iam.ServicePrincipal("cloudfront.amazonaws.com")],
          resources: [originEndpoint.attrArn],
          conditions: {
            StringEquals: {
              "aws:SourceArn": [cloudFrontDistributionArn],
            },
          },
        }),
      );
    }

    const originEndpointPolicy = new mediapackagev2.CfnOriginEndpointPolicy(
      this,
      id,
      {
        channelName: this.channelName,
        channelGroupName: this.channelGroupName,
        originEndpointName: originEndpoint.originEndpointName,
        policy: new iam.PolicyDocument({
          statements: policyStatements,
        }),
      },
    );
    originEndpointPolicy.addDependency(originEndpoint);
    return originEndpointPolicy;
  }

  // Channel Policy can only be created once the role has been created
  attachChannelPolicy(roleArn: string, cidrBlocks: Array<string> = []) {
    // Policy statement for 'roleArn' to put content to MediaPackage V2
    const policyStatements = [
      new iam.PolicyStatement({
        sid: "AllowEncoderToPushToEmpChannel",
        effect: iam.Effect.ALLOW,
        actions: ["mediapackagev2:PutObject"],
        principals: [new iam.ArnPrincipal(roleArn)],
        resources: [this.channel.attrArn],
      }),
    ];

    // Optional policy statement to restrict MediaPackage Channel to
    // receiving content from a set range of CIDR blocks
    if (Array.isArray(cidrBlocks) && cidrBlocks.length > 0) {
      policyStatements.push(
        new iam.PolicyStatement({
          sid: "AllowHttpFromRestrictedInput",
          effect: iam.Effect.DENY,
          actions: ["mediapackagev2:PutObject"],
          principals: [new iam.AnyPrincipal()],
          resources: [this.channel.attrArn],
          conditions: {
            NotIpAddress: { "aws:SourceIp": cidrBlocks },
          },
        }),
      );
    }

    // Create MediaPackage Channel policy
    const channelPolicy = new mediapackagev2.CfnChannelPolicy(
      this,
      "MediaPackageV2ChannelPolicy",
      {
        channelName: this.channelName,
        channelGroupName: this.channelGroupName,
        policy: new iam.PolicyDocument({
          statements: policyStatements,
        }),
      },
    );
    channelPolicy.addDependency(this.channel);
  }
}
