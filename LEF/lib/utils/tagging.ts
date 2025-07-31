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

import * as cdk from "aws-cdk-lib";

/**
 * Type definition for a tag collection in array format
 * Each object in the array represents a set of key-value tag pairs
 */
export type TagArray = Record<string, string>[];

/**
 * Utility class for applying and converting tags across different AWS resource types
 * 
 * AWS services have different requirements for how tags are formatted:
 * - Some resources use the CDK Tags API (cdk.Tags.of(resource).add(key, value))
 * - Some resources expect tags as an array of {key, value} objects (CfnTag[])
 * - Others expect tags as a simple key-value map object
 * 
 * This utility class provides methods to handle all these formats consistently.
 */
export class TaggingUtils {
  /**
   * Applies tags to a CDK resource using the CDK Tags API
   * 
   * @param resource The CDK resource to apply tags to
   * @param tags Array of tag objects to apply
   * @example
   * // Apply tags to an S3 bucket
   * const bucket = new s3.Bucket(this, "MyBucket");
   * TaggingUtils.applyTagsToResource(bucket, [{ Environment: "Production", Project: "LEF" }]);
   */
  public static applyTagsToResource(resource: cdk.IResource, tags?: TagArray) {
    if (!tags || tags.length === 0) return;
    
    tags.forEach(tagObj => {
      Object.entries(tagObj).forEach(([key, value]) => {
        cdk.Tags.of(resource).add(key, value);
      });
    });
  }

  /**
   * Converts tags from array format to CloudFormation tag format (CfnTag[])
   * 
   * This is useful for resources that accept a tags property directly in their constructor,
   * such as mediapackagev2.CfnChannelGroup or mediatailor.CfnPlaybackConfiguration
   * 
   * @param tags Array of tag objects
   * @returns Array of tags in CloudFormation format ({key, value} objects)
   * @example
   * // Create a MediaPackage channel group with tags
   * new mediapackagev2.CfnChannelGroup(this, "ChannelGroup", {
   *   channelGroupName: "my-group",
   *   tags: TaggingUtils.convertToCfnTags([{ Environment: "Production" }])
   * });
   */
  public static convertToCfnTags(tags?: TagArray): cdk.CfnTag[] {
    const cfnTags: cdk.CfnTag[] = [];
    
    if (!tags || tags.length === 0) return cfnTags;
    
    tags.forEach(tagObj => {
      Object.entries(tagObj).forEach(([key, value]) => {
        cfnTags.push({
          key: key,
          value: value
        });
      });
    });
    
    return cfnTags;
  }
  
  /**
   * Converts tags from array format to a flat key-value object
   * 
   * This is useful for resources that expect tags as a simple map,
   * such as MediaLive resources which use the 'tags' property as a direct key-value object
   * 
   * @param tags Array of tag objects
   * @returns Tags as a simple key-value object
   * @example
   * // Create a MediaLive channel with tags
   * new medialive.CfnChannel(this, "Channel", {
   *   // other properties...
   *   tags: TaggingUtils.convertToMapTags([{ Environment: "Production", Owner: "Media Team" }])
   * });
   */
  public static convertToMapTags(tags?: TagArray): Record<string, string> {
    const mapTags: Record<string, string> = {};
    
    if (!tags || tags.length === 0) return mapTags;
    
    tags.forEach(tagObj => {
      Object.entries(tagObj).forEach(([key, value]) => {
        mapTags[key] = value;
      });
    });
    
    return mapTags;
  }
}