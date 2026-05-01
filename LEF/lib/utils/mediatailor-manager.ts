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

import { CfnOutput, Fn } from "aws-cdk-lib";
import { Construct } from "constructs";
import { MediaTailor } from "../event_group/mediatailor";
import { IEventGroupMediaTailorConfig } from "../event_group/eventGroupConfigInterface";

export interface MediaTailorConfigResult {
  instance: MediaTailor;
  name: string;
  nameSuffix?: string;
  hostname: string;
}

export interface MediaTailorUrlPrefixes {
  hls: string;
  dash: string;
  session: string;
}

export class MediaTailorManager {
  /**
   * Creates MediaTailor configurations from an array of config objects
   */
  static createConfigurations(
    scope: Construct,
    configs: IEventGroupMediaTailorConfig[],
    baseName: string,
    resourceIdPrefix: string,
    originDomainName: string,
    cdnDomainName: string,
    tags: Record<string, string>[],
  ): MediaTailorConfigResult[] {
    return configs.map((config, index) => {
      let mediaTailorConfigResourceId = resourceIdPrefix;
      if (config.name && config.name !== "") {
        mediaTailorConfigResourceId = `${resourceIdPrefix}-${config.name}`;
      }

      const mediaTailor = new MediaTailor(scope, mediaTailorConfigResourceId, {
        configurationName: baseName,
        configurationNameSuffix: config.name,
        configuration: config,
        originDomainName: originDomainName,
        cdnDomainName: cdnDomainName,
        tags: tags,
      });

      return {
        instance: mediaTailor,
        name: baseName,
        nameSuffix: config.name,
        hostname: mediaTailor.configHostname,
      };
    });
  }

  /**
   * Creates standard outputs for MediaTailor configurations
   */
  static createOutputs(
    scope: Construct,
    configs: MediaTailorConfigResult[],
    cdnDomainName: string,
    outputPrefix: string = "",
    exportPrefix?: string,
  ): void {
    if (configs.length === 0) return;

    // Create ARN list output
    const arnList = configs.map(
      (config) => config.instance.playbackConfigurationArn,
    );
    const arnListOutputId = outputPrefix
      ? `${outputPrefix}MediaTailorPlaybackConfigurationArnList`
      : "MediaTailorPlaybackConfigurationArnList";
    const arnListExportName = exportPrefix
      ? `${exportPrefix}-MediaTailor-Playback-Configuration-Arn-List`
      : undefined;

    new CfnOutput(scope, arnListOutputId, {
      value: arnList.join("|"),
      exportName: arnListExportName,
      description: `List of all ${outputPrefix ? outputPrefix.toLowerCase() + " " : ""}MediaTailor Playback Configuration ARNs`,
    });

    // Get primary configuration (first in array)
    const primaryConfig = configs[0];

    // Extract paths from MediaTailor endpoints and combine with CloudFront domain
    const hlsPath = Fn.select(
      1,
      Fn.split("amazonaws.com", primaryConfig.instance.hlsEndpoint),
    );
    const dashPath = Fn.select(
      1,
      Fn.split("amazonaws.com", primaryConfig.instance.dashEndpoint),
    );
    const sessionPath = Fn.select(
      1,
      Fn.split("amazonaws.com", primaryConfig.instance.sessionEndpoint),
    );

    const hlsPlaybackPrefix = `https://${cdnDomainName}${hlsPath}`;
    const dashPlaybackPrefix = `https://${cdnDomainName}${dashPath}`;
    const sessionPrefix = `https://${cdnDomainName}${sessionPath}`;

    // Create primary configuration outputs
    const hlsOutputId = outputPrefix
      ? `${outputPrefix}MediaTailorHlsPlaybackPrefix`
      : "MediaTailorHlsPlaybackPrefix";
    const hlsExportName = exportPrefix
      ? `${exportPrefix}-MediaTailor-Hls-Playback-Prefix`
      : undefined;
    new CfnOutput(scope, hlsOutputId, {
      value: hlsPlaybackPrefix,
      exportName: hlsExportName,
      description: `${outputPrefix ? outputPrefix + " " : ""}MediaTailor HLS Playback Prefix (primary configuration)`,
    });

    const dashOutputId = outputPrefix
      ? `${outputPrefix}MediaTailorDashPlaybackPrefix`
      : "MediaTailorDashPlaybackPrefix";
    const dashExportName = exportPrefix
      ? `${exportPrefix}-MediaTailor-Dash-Playback-Prefix`
      : undefined;
    new CfnOutput(scope, dashOutputId, {
      value: dashPlaybackPrefix,
      exportName: dashExportName,
      description: `${outputPrefix ? outputPrefix + " " : ""}MediaTailor DASH Playback Prefix (primary configuration)`,
    });

    const sessionOutputId = outputPrefix
      ? `${outputPrefix}MediaTailorSessionPrefix`
      : "MediaTailorSessionPrefix";
    const sessionExportName = exportPrefix
      ? `${exportPrefix}-MediaTailor-Session-Prefix`
      : undefined;
    new CfnOutput(scope, sessionOutputId, {
      value: sessionPrefix,
      exportName: sessionExportName,
      description: `${outputPrefix ? outputPrefix + " " : ""}MediaTailor Session Prefix (primary configuration)`,
    });

    const arnOutputId = outputPrefix
      ? `${outputPrefix}MediaTailorPlaybackConfigurationArn`
      : "MediaTailorPlaybackConfigurationArn";
    const arnExportName = exportPrefix
      ? `${exportPrefix}-MediaTailor-Playback-Configuration-Arn`
      : undefined;
    new CfnOutput(scope, arnOutputId, {
      value: primaryConfig.instance.playbackConfigurationArn,
      exportName: arnExportName,
      description: `${outputPrefix ? outputPrefix + " " : ""}MediaTailor Playback Configuration ARN (primary configuration)`,
    });

    // Create individual configuration outputs if there are multiple
    if (configs.length > 1) {
      configs.forEach((config) => {
        const configHlsPath = Fn.select(
          1,
          Fn.split("amazonaws.com", config.instance.hlsEndpoint),
        );
        const configDashPath = Fn.select(
          1,
          Fn.split("amazonaws.com", config.instance.dashEndpoint),
        );
        const configSessionPath = Fn.select(
          1,
          Fn.split("amazonaws.com", config.instance.sessionEndpoint),
        );

        const configHlsPrefix = `https://${cdnDomainName}${configHlsPath}`;
        const configDashPrefix = `https://${cdnDomainName}${configDashPath}`;
        const configSessionPrefix = `https://${cdnDomainName}${configSessionPath}`;

        const configArnOutputId = `${outputPrefix}MediaTailorPlaybackConfigurationArn-${config.nameSuffix}`;
        const configArnExportName = exportPrefix
          ? `${exportPrefix}-MediaTailor-${config.nameSuffix}-Playback-Configuration-Arn`
          : undefined;
        new CfnOutput(scope, configArnOutputId, {
          value: config.instance.playbackConfigurationArn,
          exportName: configArnExportName,
          description: `${outputPrefix ? outputPrefix + " " : ""}MediaTailor ${config.nameSuffix} Playback Configuration ARN`,
        });

        const configHlsOutputId = `${outputPrefix}MediaTailorHlsPlaybackPrefix-${config.nameSuffix}`;
        const configHlsExportName = exportPrefix
          ? `${exportPrefix}-MediaTailor-${config.nameSuffix}-Hls-Playback-Prefix`
          : undefined;
        new CfnOutput(scope, configHlsOutputId, {
          value: configHlsPrefix,
          exportName: configHlsExportName,
          description: `${outputPrefix ? outputPrefix + " " : ""}HLS Playback Prefix for ${config.nameSuffix} configuration`,
        });

        const configDashOutputId = `${outputPrefix}MediaTailorDashPlaybackPrefix-${config.nameSuffix}`;
        const configDashExportName = exportPrefix
          ? `${exportPrefix}-MediaTailor-${config.nameSuffix}-Dash-Playback-Prefix`
          : undefined;
        new CfnOutput(scope, configDashOutputId, {
          value: configDashPrefix,
          exportName: configDashExportName,
          description: `${outputPrefix ? outputPrefix + " " : ""}DASH Playback Prefix for ${config.nameSuffix} configuration`,
        });

        const configSessionOutputId = `${outputPrefix}MediaTailorSessionPrefix-${config.nameSuffix}`;
        const configSessionExportName = exportPrefix
          ? `${exportPrefix}-MediaTailor-${config.nameSuffix}-Session-Prefix`
          : undefined;
        new CfnOutput(scope, configSessionOutputId, {
          value: configSessionPrefix,
          exportName: configSessionExportName,
          description: `${outputPrefix ? outputPrefix + " " : ""}Session Prefix for ${config.nameSuffix} configuration`,
        });
      });
    }
  }

  /**
   * Builds URL prefixes for MediaTailor endpoints
   */
  static buildUrlPrefixes(
    cdnDomainName: string,
    configurationName: string,
  ): MediaTailorUrlPrefixes {
    return {
      hls: `https://${cdnDomainName}/v1/master/${configurationName}/`,
      dash: `https://${cdnDomainName}/v1/dash/${configurationName}/`,
      session: `https://${cdnDomainName}/v1/session/${configurationName}/`,
    };
  }
}
