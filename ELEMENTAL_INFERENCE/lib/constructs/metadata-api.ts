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

import { CfnOutput } from "aws-cdk-lib";
import {
  RestApi,
  LambdaIntegration,
  ApiKeySourceType,
  ApiKey,
  UsagePlan,
} from "aws-cdk-lib/aws-apigateway";
import { Function, Runtime, Code } from "aws-cdk-lib/aws-lambda";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import { NagSuppressions } from "cdk-nag";
import * as path from "path";

/**
 * Props for the MetadataApi construct.
 */
export interface MetadataApiProps {
  /** SQS queue URL for the GetEvents Lambda to poll */
  sqsQueueUrl: string;
  /** SQS queue ARN for scoping GetEvents Lambda IAM permissions */
  sqsQueueArn: string;
  /** Optional resource tags */
  tags?: Record<string, string>;
}

/**
 * Encapsulates a REST API (API Gateway + Lambda) for retrieving Elemental
 * Inference feed metadata and clipping event data.
 *
 * Endpoints:
 * - GET /feeds       → ListFeeds Lambda (elementalinference:ListFeeds)
 * - GET /feeds/{feedId} → GetFeed Lambda (elementalinference:GetFeed)
 * - GET /events      → GetEvents Lambda (sqs:ReceiveMessage + sqs:DeleteMessage)
 *
 * All endpoints require API key authentication via a usage plan.
 */
export class MetadataApi extends Construct {
  /** The API Gateway endpoint URL */
  public readonly apiEndpointUrl: string;
  /** The API key ID for access control */
  public readonly apiKeyId: string;

  constructor(scope: Construct, id: string, props: MetadataApiProps) {
    super(scope, id);

    const lambdaDir = path.join(__dirname, "../../lambda");

    // --- REST API ---
    const api = new RestApi(this, "InferenceApi", {
      restApiName: "EI-Metadata-API",
      description: "Elemental Inference metadata and clipping events API",
      apiKeySourceType: ApiKeySourceType.HEADER,
    });

    // --- API Key + Usage Plan ---
    const apiKey = new ApiKey(this, "ApiKey", {
      description: "API key for Elemental Inference Metadata API",
    });

    const usagePlan = new UsagePlan(this, "UsagePlan", {
      name: "EI-Metadata-UsagePlan",
      apiStages: [{ api, stage: api.deploymentStage }],
    });
    usagePlan.addApiKey(apiKey);

    // --- ListFeeds Lambda ---
    const listFeedsFn = new Function(this, "ListFeedsFn", {
      runtime: Runtime.NODEJS_24_X,
      handler: "index.handler",
      code: Code.fromAsset(path.join(lambdaDir, "list-feeds")),
    });
    listFeedsFn.addToRolePolicy(
      new PolicyStatement({
        actions: ["elementalinference:ListFeeds"],
        resources: ["*"],
      }),
    );

    // --- GetFeed Lambda ---
    const getFeedFn = new Function(this, "GetFeedFn", {
      runtime: Runtime.NODEJS_24_X,
      handler: "index.handler",
      code: Code.fromAsset(path.join(lambdaDir, "get-feed")),
    });
    getFeedFn.addToRolePolicy(
      new PolicyStatement({
        actions: ["elementalinference:GetFeed"],
        resources: ["*"],
      }),
    );

    // --- GetEvents Lambda ---
    const getEventsFn = new Function(this, "GetEventsFn", {
      runtime: Runtime.NODEJS_24_X,
      handler: "index.handler",
      code: Code.fromAsset(path.join(lambdaDir, "get-events")),
      environment: {
        SQS_QUEUE_URL: props.sqsQueueUrl,
      },
    });
    getEventsFn.addToRolePolicy(
      new PolicyStatement({
        actions: ["sqs:ReceiveMessage", "sqs:DeleteMessage"],
        resources: [props.sqsQueueArn],
      }),
    );

    // --- Wire API routes ---
    const feedsResource = api.root.addResource("feeds");
    feedsResource.addMethod("GET", new LambdaIntegration(listFeedsFn), {
      apiKeyRequired: true,
    });

    const feedIdResource = feedsResource.addResource("{feedId}");
    feedIdResource.addMethod("GET", new LambdaIntegration(getFeedFn), {
      apiKeyRequired: true,
    });

    const eventsResource = api.root.addResource("events");
    eventsResource.addMethod("GET", new LambdaIntegration(getEventsFn), {
      apiKeyRequired: true,
    });

    // --- Outputs ---
    this.apiEndpointUrl = api.url;
    this.apiKeyId = apiKey.keyId;

    new CfnOutput(this, "ApiEndpointUrl", {
      value: api.url,
      description: "Metadata API endpoint URL",
    });

    new CfnOutput(this, "ApiKeyId", {
      value: apiKey.keyId,
      description: "API key ID for Metadata API access",
    });

    // --- cdk-nag suppressions ---
    NagSuppressions.addResourceSuppressions(
      listFeedsFn,
      [
        {
          id: "AwsSolutions-IAM5",
          reason:
            "elementalinference:ListFeeds does not support resource-level permissions — wildcard resource is required.",
        },
      ],
      true,
    );

    NagSuppressions.addResourceSuppressions(
      getFeedFn,
      [
        {
          id: "AwsSolutions-IAM5",
          reason:
            "elementalinference:GetFeed does not support resource-level permissions — wildcard resource is required.",
        },
      ],
      true,
    );

    NagSuppressions.addResourceSuppressions(
      [listFeedsFn, getFeedFn, getEventsFn],
      [
        {
          id: "AwsSolutions-IAM4",
          reason:
            "CDK-managed Lambda execution role uses AWSLambdaBasicExecutionRole managed policy for CloudWatch logging.",
        },
        {
          id: "AwsSolutions-L1",
          reason:
            "Node.js 24.x is the latest available runtime; cdk-nag may not recognize it yet.",
        },
      ],
      true,
    );

    NagSuppressions.addResourceSuppressions(
      api,
      [
        {
          id: "AwsSolutions-APIG2",
          reason:
            "Request validation is not required for this read-only metadata API — all inputs are path parameters or absent.",
        },
        {
          id: "AwsSolutions-APIG1",
          reason:
            "Access logging is not configured for this reference architecture sample API.",
        },
        {
          id: "AwsSolutions-APIG3",
          reason:
            "WAF is not required for this internal reference architecture sample API.",
        },
        {
          id: "AwsSolutions-APIG4",
          reason:
            "API uses API key authentication via usage plan; Cognito/IAM authorizer not required for this reference architecture.",
        },
        {
          id: "AwsSolutions-COG4",
          reason:
            "API uses API key authentication via usage plan; Cognito authorizer not required for this reference architecture.",
        },
        {
          id: "AwsSolutions-APIG6",
          reason:
            "CloudWatch execution logging is not configured for this reference architecture sample API.",
        },
      ],
      true,
    );
  }
}
