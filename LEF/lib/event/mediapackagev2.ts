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
  IManifestConfig,
  IInputSwitchConfig,
  IOutputHeaderConfig,
  IChannelPolicyConfig,
} from "./eventConfigInterface";
import { TaggingUtils } from "../utils/tagging";

const SUPPORTED_MANIFEST_TYPE_EXTENSIONS = {
  hlsManifests: "m3u8",
  lowLatencyHlsManifests: "m3u8",
  dashManifests: "mpd",
};

export interface IMediaPackageV2Props {
  channelName: string;
  channelGroupName: string;
  configuration: IMediaPackageChannelConfig;
  tags: Record<string, string>[];
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
  private channelPolicyConfig?: IChannelPolicyConfig;

  constructor(scope: Construct, id: string, props: IMediaPackageV2Props) {
    super(scope, id);
    this.channelGroupName = props.channelGroupName;
    this.channelName = props.channelName;
    this.channelInputType = props.configuration.inputType;

    // Apply defaults for CMAF input type
    const configWithDefaults = this.applyDefaults(props.configuration);
    
    // Validate configuration
    this.validateConfiguration(configWithDefaults);

    /*
     * Create MediaPackage Channel
     */
    const channelProps: mediapackagev2.CfnChannelProps = {
      channelName: this.channelName,
      channelGroupName: this.channelGroupName,
      description: props.configuration.description || `Channel for ${Aws.STACK_NAME}`,
      inputType: this.channelInputType,
      tags: TaggingUtils.convertToCfnTags(props.tags),
      // Add input switch configuration if provided and input type is CMAF
      ...(configWithDefaults.inputSwitchConfiguration && this.channelInputType === "CMAF" && {
        inputSwitchConfiguration: this.buildInputSwitchConfiguration(configWithDefaults.inputSwitchConfiguration),
      }),
      // Add output header configuration if provided and input type is CMAF
      ...(configWithDefaults.outputHeaderConfiguration && this.channelInputType === "CMAF" && {
        outputHeaderConfiguration: this.buildOutputHeaderConfiguration(configWithDefaults.outputHeaderConfiguration),
      }),
    };

    this.channel = new mediapackagev2.CfnChannel(
      this,
      "MediaPackageV2Channel",
      channelProps,
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
    const mediaTailorPlaybackConfigurationArnListImport = Fn.importValue(
      this.channelGroupName + "-MediaTailor-Playback-Configuration-Arn-List",
    );
    const mediaTailorPlaybackConfigurationArnList = Fn.split('|', mediaTailorPlaybackConfigurationArnListImport);

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
      // Process HLS manifests to set default values
      let processedEndpointConfig = { ...endpointConfig };
      
      // Apply defaults to HLS manifests
      if (processedEndpointConfig.hlsManifests && Array.isArray(processedEndpointConfig.hlsManifests)) {
        processedEndpointConfig.hlsManifests = processedEndpointConfig.hlsManifests.map(manifest => 
          this.setHlsManifestDefaults(manifest)
        );
      }
      
      // Apply defaults to Low Latency HLS manifests
      if (processedEndpointConfig.lowLatencyHlsManifests && Array.isArray(processedEndpointConfig.lowLatencyHlsManifests)) {
        processedEndpointConfig.lowLatencyHlsManifests = processedEndpointConfig.lowLatencyHlsManifests.map(manifest => 
          this.setHlsManifestDefaults(manifest)
        );
      }
      
      // Create origin endpoint
      const endpoint = this.createOriginEndpoint(
        endpointReference,
        processedEndpointConfig,
        props.tags,
      );
      endpoint.addDependency(this.channel);

      // Attach policy to origin endpoint
      const policy = this.attachPolicyToOriginEndpoint(
        endpointReference + "Policy",
        endpoint,
        mediaTailorPlaybackConfigurationArnList,
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

    // Attach channel policy if configured
    if (props.configuration.channelPolicy?.enabled) {
      // This will be called later when the MediaLive role is available
      // Store the configuration for later use
      this.channelPolicyConfig = props.configuration.channelPolicy;
    }
  }

  /**
   * Applies default configurations for CMAF input type when not specified
   * @param config - The original configuration
   * @returns Configuration with defaults applied
   */
  private applyDefaults(config: IMediaPackageChannelConfig): IMediaPackageChannelConfig {
    const configWithDefaults = { ...config };
    
    // Apply defaults only for CMAF input type
    // TODO: These defaults should be adjusted as best practice settings become clear
    if (config.inputType === "CMAF") {
      // Set default input switch configuration if not provided
      if (!config.inputSwitchConfiguration) {
        configWithDefaults.inputSwitchConfiguration = {
          mqcsInputSwitching: true,
          inputSwitchingMode: "FAILOVER_ON_AVERAGE",
          switchingThreshold: 70,
        };
      }
      
      // Set default output header configuration if not provided
      // TODO: These defaults should be adjusted as best practice settings become clear
      if (!config.outputHeaderConfiguration) {
        configWithDefaults.outputHeaderConfiguration = {
          publishMqcs: true,
          additionalHeaders: {
            includeBufferHealth: true,
            includeThroughput: true,
          },
        };
      }
    }
    
    return configWithDefaults;
  }

  /**
   * Sets default values for HLS manifest properties
   * @param manifest - The original manifest object
   * @returns A new manifest object with default values set
   */
  private setHlsManifestDefaults(manifest: IManifestConfig): IManifestConfig {
    const manifestCopy = { ...manifest };
    
    // Set urlEncodeChildManifest to true by default if not explicitly set
    if (manifestCopy.urlEncodeChildManifest === undefined) {
      manifestCopy.urlEncodeChildManifest = true;
    }
    
    // Additional default values can be set here in the future
    
    return manifestCopy;
  }

  /**
   * Validates the MediaPackage channel configuration
   * @param config - The channel configuration to validate
   */
  private validateConfiguration(config: IMediaPackageChannelConfig): void {
    // Validate CMAF-only configuration options
    if (config.inputSwitchConfiguration && config.inputType !== "CMAF") {
      Annotations.of(this).addWarning(
        "inputSwitchConfiguration is only valid when inputType is CMAF. " +
        "This configuration will be ignored for HLS input type."
      );
    }

    if (config.outputHeaderConfiguration && config.inputType !== "CMAF") {
      Annotations.of(this).addWarning(
        "outputHeaderConfiguration is only valid when inputType is CMAF. " +
        "This configuration will be ignored for HLS input type."
      );
    }

    // Validate input switch configuration values
    if (config.inputSwitchConfiguration?.switchingThreshold !== undefined) {
      const threshold = config.inputSwitchConfiguration.switchingThreshold;
      if (threshold < 0 || threshold > 100) {
        Annotations.of(this).addError(
          "switchingThreshold must be between 0 and 100"
        );
      }
    }
  }

  /**
   * Builds the input switch configuration for the channel
   * @param config - The input switch configuration
   * @returns The CDK-compatible input switch configuration
   */
  private buildInputSwitchConfiguration(config: IInputSwitchConfig): any {
    const inputSwitchConfig: any = {};
    
    if (config.mqcsInputSwitching !== undefined) {
      inputSwitchConfig.mqcsInputSwitching = config.mqcsInputSwitching;
    }
    
    // Add additional configuration options as they become available in CDK
    // Note: inputSwitchingMode and switchingThreshold may not be available yet
    // in the current CDK version but can be added when supported
    
    return inputSwitchConfig;
  }

  /**
   * Builds the output header configuration for the channel
   * @param config - The output header configuration
   * @returns The CDK-compatible output header configuration
   */
  private buildOutputHeaderConfiguration(config: IOutputHeaderConfig): any {
    const outputHeaderConfig: any = {};
    
    if (config.publishMqcs !== undefined) {
      outputHeaderConfig.publishMqcs = config.publishMqcs;
    }
    
    // Add additional header configuration options as they become available
    // Note: additionalHeaders may not be available yet in the current CDK version
    
    return outputHeaderConfig;
  }

  // Create Origin Endpoint
  createOriginEndpoint(id: string, props: IMediaPackageEndpointConfig, tags: Record<string, string>[]) {
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
      tags: TaggingUtils.convertToCfnTags(tags),
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
    mediaTailorPlaybackConfigurationArnList: string[],
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
        // Policy allowing SigV4 signed requests from all MediaTailor Playback
        // Configurations in the group
        new iam.PolicyStatement({
          sid: "AllowRequestsFromMediaTailorPlaybackConfiguration",
          effect: iam.Effect.ALLOW,
          actions: ["mediapackagev2:GetObject", "mediapackagev2:GetHeadObject"],
          principals: [new iam.ServicePrincipal("mediatailor.amazonaws.com")],
          resources: [originEndpoint.attrArn],
          conditions: {
            StringEquals: {
              "aws:SourceArn": mediaTailorPlaybackConfigurationArnList,
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
    // Use configured CIDR blocks if available, otherwise use provided ones
    const effectiveCidrBlocks = this.channelPolicyConfig?.allowedCidrBlocks || cidrBlocks;
    
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
    if (Array.isArray(effectiveCidrBlocks) && effectiveCidrBlocks.length > 0) {
      policyStatements.push(
        new iam.PolicyStatement({
          sid: "AllowHttpFromRestrictedInput",
          effect: iam.Effect.DENY,
          actions: ["mediapackagev2:PutObject"],
          principals: [new iam.AnyPrincipal()],
          resources: [this.channel.attrArn],
          conditions: {
            NotIpAddress: { "aws:SourceIp": effectiveCidrBlocks },
          },
        }),
      );
    }

    // Add custom policy statements if configured
    if (this.channelPolicyConfig?.customPolicyStatements) {
      for (const customStatement of this.channelPolicyConfig.customPolicyStatements) {
        // Convert plain object to PolicyStatement
        policyStatements.push(
          new iam.PolicyStatement({
            ...customStatement,
            principals: customStatement.principals?.map((p: any) => 
              typeof p === 'string' ? new iam.ArnPrincipal(p) : p
            ),
          })
        );
      }
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
