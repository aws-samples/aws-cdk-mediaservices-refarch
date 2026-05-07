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
  aws_logs as logs,
  aws_s3 as s3,
  aws_kinesisfirehose as firehose,
  aws_iam as iam,
  RemovalPolicy,
  Duration,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  IMediaPackageLoggingConfig,
  ILogDeliveryConfig,
} from "./eventGroupConfigInterface";
import { TaggingUtils } from "../utils/tagging";

export interface IMediaPackageLoggingProps {
  channelGroupArn: string;
  channelGroupName: string;
  configuration: IMediaPackageLoggingConfig;
  tags: Record<string, string>[];
}

export class MediaPackageLogging extends Construct {
  public readonly logGroupArns: string[] = [];
  public readonly s3Buckets: s3.Bucket[] = [];
  public readonly firehoseStreams: firehose.CfnDeliveryStream[] = [];
  public readonly deliverySources: logs.CfnDeliverySource[] = [];
  public readonly deliveryDestinations: logs.CfnDeliveryDestination[] = [];
  public readonly deliveries: logs.CfnDelivery[] = [];
  private readonly channelGroupName: string;

  constructor(scope: Construct, id: string, props: IMediaPackageLoggingProps) {
    super(scope, id);
    this.channelGroupName = props.channelGroupName;

    if (!props.configuration.enabled) {
      return;
    }

    // Create delivery destinations for egress access logs
    if (props.configuration.egressAccessLogs) {
      this.createLogDeliveries(
        "Egress",
        "EGRESS_ACCESS_LOGS",
        props.configuration.egressAccessLogs,
        props.channelGroupArn,
        props.channelGroupName,
        props.tags,
      );
    }

    // Create delivery destinations for ingress access logs
    if (props.configuration.ingressAccessLogs) {
      this.createLogDeliveries(
        "Ingress",
        "INGRESS_ACCESS_LOGS",
        props.configuration.ingressAccessLogs,
        props.channelGroupArn,
        props.channelGroupName,
        props.tags,
      );
    }
  }

  private createLogDeliveries(
    logType: string,
    logTypeConstant: string,
    deliveryConfigs: ILogDeliveryConfig[],
    channelGroupArn: string,
    channelGroupName: string,
    tags: Record<string, string>[],
  ): void {
    // Create delivery source for this log type
    const deliverySource = this.createDeliverySource(
      logType,
      logTypeConstant,
      channelGroupArn,
      channelGroupName,
      tags,
    );

    deliveryConfigs.forEach((config, index) => {
      const suffix = deliveryConfigs.length > 1 ? `${index + 1}` : "";
      const resourceId = `${logType}${suffix}`;

      // Create the destination resource (S3, CloudWatch, Firehose)
      let destinationArn: string;

      switch (config.destinationType) {
        case "CLOUDWATCH_LOGS":
          destinationArn = this.createCloudWatchLogsDestination(
            resourceId,
            config,
            tags,
            channelGroupName,
          );
          break;
        case "S3":
          const bucket = this.createS3Destination(resourceId, config, tags);
          destinationArn = bucket.bucketArn;
          break;
        case "FIREHOSE":
          const stream = this.createFirehoseDestination(
            resourceId,
            config,
            tags,
          );
          destinationArn = `arn:aws:firehose:${Aws.REGION}:${Aws.ACCOUNT_ID}:deliverystream/${stream.deliveryStreamName}`;
          break;
        default:
          throw new Error(
            `Unsupported destination type: ${config.destinationType}`,
          );
      }

      // Create delivery destination
      const deliveryDestination = this.createDeliveryDestination(
        resourceId,
        config,
        destinationArn,
        tags,
      );

      // Create delivery to link source and destination
      this.createDelivery(
        resourceId,
        deliverySource,
        deliveryDestination,
        tags,
      );
    });
  }

  private createDeliverySource(
    logType: string,
    logTypeConstant: string,
    channelGroupArn: string,
    channelGroupName: string,
    tags: Record<string, string>[],
  ): logs.CfnDeliverySource {
    const deliverySource = new logs.CfnDeliverySource(
      this,
      `DeliverySource${logType}`,
      {
        name: `${channelGroupName}-${logType.toLowerCase()}-source`,
        resourceArn: channelGroupArn,
        logType: logTypeConstant,
        tags: TaggingUtils.convertToCfnTags(tags),
      },
    );

    this.deliverySources.push(deliverySource);
    return deliverySource;
  }

  private createDeliveryDestination(
    resourceId: string,
    config: ILogDeliveryConfig,
    destinationArn: string,
    tags: Record<string, string>[],
  ): logs.CfnDeliveryDestination {
    const deliveryDestination = new logs.CfnDeliveryDestination(
      this,
      `DeliveryDestination${resourceId}`,
      {
        name: `${this.channelGroupName}-${resourceId.toLowerCase()}-destination`,
        destinationResourceArn: destinationArn,
        outputFormat: config.outputFormat || "json",
        tags: TaggingUtils.convertToCfnTags(tags),
      },
    );

    this.deliveryDestinations.push(deliveryDestination);
    return deliveryDestination;
  }

  private createDelivery(
    resourceId: string,
    deliverySource: logs.CfnDeliverySource,
    deliveryDestination: logs.CfnDeliveryDestination,
    tags: Record<string, string>[],
  ): logs.CfnDelivery {
    const delivery = new logs.CfnDelivery(this, `Delivery${resourceId}`, {
      deliverySourceName: deliverySource.name!,
      deliveryDestinationArn: deliveryDestination.attrArn,
      tags: TaggingUtils.convertToCfnTags(tags),
    });

    delivery.addDependency(deliverySource);
    delivery.addDependency(deliveryDestination);

    this.deliveries.push(delivery);
    return delivery;
  }

  private createCloudWatchLogsDestination(
    suffix: string,
    config: ILogDeliveryConfig,
    tags: Record<string, string>[],
    channelGroupName: string,
  ): string {
    const logGroupName =
      config.logGroupName ||
      `/aws/mediapackagev2/${channelGroupName}/${suffix.toLowerCase()}AccessLogs`;

    // Create the actual log group resource
    const logGroup = new logs.LogGroup(this, `LogGroup${suffix}`, {
      logGroupName: logGroupName,
      retention: this.getRetentionDays(config.retentionInDays),
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Apply tags
    TaggingUtils.applyTagsToResource(logGroup, tags);

    this.logGroupArns.push(logGroup.logGroupArn);
    return logGroup.logGroupArn;
  }

  private createS3Destination(
    suffix: string,
    config: ILogDeliveryConfig,
    tags: Record<string, string>[],
  ): s3.Bucket {
    const bucket = new s3.Bucket(this, `LogBucket${suffix}`, {
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      enforceSSL: true,
      serverAccessLogsPrefix: "access-logs/",
      lifecycleRules: [
        {
          id: "DeleteOldLogs",
          enabled: true,
          expiration: Duration.days(90), // Default 90 day retention
        },
      ],
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    // Apply tags using TaggingUtils
    TaggingUtils.applyTagsToResource(bucket, tags);

    // Add bucket policy for CloudWatch Logs vended logs
    bucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "AllowCloudWatchLogsDelivery",
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal("logs.amazonaws.com")],
        actions: ["s3:PutObject", "s3:GetBucketAcl"],
        resources: [bucket.bucketArn, `${bucket.bucketArn}/*`],
        conditions: {
          StringEquals: {
            "aws:SourceAccount": Aws.ACCOUNT_ID,
          },
        },
      }),
    );

    this.s3Buckets.push(bucket);
    return bucket;
  }

  private createFirehoseDestination(
    suffix: string,
    config: ILogDeliveryConfig,
    tags: Record<string, string>[],
  ): firehose.CfnDeliveryStream {
    // Create S3 destination for Firehose
    const s3Destination = this.createS3Destination(
      `${suffix}Firehose`,
      config,
      tags,
    );

    // Create IAM role for Firehose scoped to the destination bucket
    const firehoseRole = new iam.Role(this, `FirehoseRole${suffix}`, {
      assumedBy: new iam.ServicePrincipal("firehose.amazonaws.com"),
      inlinePolicies: {
        FirehoseDeliveryPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                "s3:AbortMultipartUpload",
                "s3:GetBucketLocation",
                "s3:GetObject",
                "s3:ListBucket",
                "s3:ListBucketMultipartUploads",
                "s3:PutObject",
              ],
              resources: [
                s3Destination.bucketArn,
                `${s3Destination.bucketArn}/*`,
              ],
            }),
          ],
        }),
      },
    });

    const deliveryStream = new firehose.CfnDeliveryStream(
      this,
      `DeliveryStream${suffix}`,
      {
        deliveryStreamName: `${this.channelGroupName}-logs-${suffix.toLowerCase()}`,
        deliveryStreamType: "DirectPut",
        s3DestinationConfiguration: {
          bucketArn: s3Destination.bucketArn,
          roleArn: firehoseRole.roleArn,
          prefix: config.s3Suffix || "logs/",
          bufferingHints: {
            sizeInMBs: 5,
            intervalInSeconds: 300,
          },
          compressionFormat: "GZIP",
        },
        tags: TaggingUtils.convertToCfnTags(tags),
      },
    );

    this.firehoseStreams.push(deliveryStream);
    return deliveryStream;
  }

  private getRetentionDays(retentionInDays?: number): logs.RetentionDays {
    const days = retentionInDays || 30;

    // Map to valid CloudWatch Logs retention values
    if (days <= 1) return logs.RetentionDays.ONE_DAY;
    if (days <= 3) return logs.RetentionDays.THREE_DAYS;
    if (days <= 5) return logs.RetentionDays.FIVE_DAYS;
    if (days <= 7) return logs.RetentionDays.ONE_WEEK;
    if (days <= 14) return logs.RetentionDays.TWO_WEEKS;
    if (days <= 30) return logs.RetentionDays.ONE_MONTH;
    if (days <= 60) return logs.RetentionDays.TWO_MONTHS;
    if (days <= 90) return logs.RetentionDays.THREE_MONTHS;
    if (days <= 120) return logs.RetentionDays.FOUR_MONTHS;
    if (days <= 150) return logs.RetentionDays.FIVE_MONTHS;
    if (days <= 180) return logs.RetentionDays.SIX_MONTHS;
    if (days <= 365) return logs.RetentionDays.ONE_YEAR;
    if (days <= 400) return logs.RetentionDays.THIRTEEN_MONTHS;
    if (days <= 545) return logs.RetentionDays.EIGHTEEN_MONTHS;
    if (days <= 730) return logs.RetentionDays.TWO_YEARS;
    if (days <= 1827) return logs.RetentionDays.FIVE_YEARS;
    if (days <= 3653) return logs.RetentionDays.TEN_YEARS;

    return logs.RetentionDays.INFINITE;
  }
}
