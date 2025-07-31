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
import { Template } from "aws-cdk-lib/assertions";
import { TaggingUtils, TagArray } from "../../lib/utils/tagging";
import { Construct } from "constructs";
import { aws_s3 as s3 } from "aws-cdk-lib";

describe("TaggingUtils", () => {
  describe("convertToCfnTags", () => {
    test("converts tag array to CfnTag array", () => {
      // Arrange
      const tags: TagArray = [
        {
          Key1: "Value1",
          Key2: "Value2"
        }
      ];

      // Act
      const result = TaggingUtils.convertToCfnTags(tags);

      // Assert
      expect(result).toEqual([
        { key: "Key1", value: "Value1" },
        { key: "Key2", value: "Value2" }
      ]);
    });

    test("handles empty array", () => {
      expect(TaggingUtils.convertToCfnTags([])).toEqual([]);
    });

    test("handles undefined input", () => {
      expect(TaggingUtils.convertToCfnTags(undefined)).toEqual([]);
    });

    test("handles multiple tag objects in array", () => {
      // Arrange
      const tags: TagArray = [
        { Key1: "Value1" },
        { Key2: "Value2" }
      ];

      // Act
      const result = TaggingUtils.convertToCfnTags(tags);

      // Assert
      expect(result).toEqual([
        { key: "Key1", value: "Value1" },
        { key: "Key2", value: "Value2" }
      ]);
    });
  });

  describe("convertToMapTags", () => {
    test("converts tag array to map object", () => {
      // Arrange
      const tags: TagArray = [
        {
          Key1: "Value1",
          Key2: "Value2"
        }
      ];

      // Act
      const result = TaggingUtils.convertToMapTags(tags);

      // Assert
      expect(result).toEqual({
        Key1: "Value1",
        Key2: "Value2"
      });
    });

    test("handles empty array", () => {
      expect(TaggingUtils.convertToMapTags([])).toEqual({});
    });

    test("handles undefined input", () => {
      expect(TaggingUtils.convertToMapTags(undefined)).toEqual({});
    });

    test("handles multiple tag objects in array", () => {
      // Arrange
      const tags: TagArray = [
        { Key1: "Value1" },
        { Key2: "Value2" }
      ];

      // Act
      const result = TaggingUtils.convertToMapTags(tags);

      // Assert
      expect(result).toEqual({
        Key1: "Value1",
        Key2: "Value2"
      });
    });

    test("last value wins for duplicate keys", () => {
      // Arrange
      const tags: TagArray = [
        { Key1: "Value1" },
        { Key1: "Value2" }
      ];

      // Act
      const result = TaggingUtils.convertToMapTags(tags);

      // Assert
      expect(result).toEqual({
        Key1: "Value2"
      });
    });
  });

  describe("applyTagsToResource", () => {
    test("applies tags to CDK resource", () => {
      // Arrange
      const app = new cdk.App();
      const stack = new cdk.Stack(app, "TestStack");
      const bucket = new s3.Bucket(stack, "TestBucket", {
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
      });
      
      const tags: TagArray = [
        {
          Key1: "Value1",
          Key2: "Value2"
        }
      ];

      // Act
      TaggingUtils.applyTagsToResource(bucket, tags);

      // Assert
      const template = Template.fromStack(stack);
      // Check that the bucket has the expected tags, ignoring any auto-generated tags
      const bucketResources = template.findResources("AWS::S3::Bucket");
      const bucketId = Object.keys(bucketResources)[0];
      const bucketTags = bucketResources[bucketId].Properties.Tags;
      
      // Find our specific tags in the array
      const key1Tag = bucketTags.find((tag: any) => tag.Key === "Key1");
      const key2Tag = bucketTags.find((tag: any) => tag.Key === "Key2");
      
      expect(key1Tag).toEqual({ Key: "Key1", Value: "Value1" });
      expect(key2Tag).toEqual({ Key: "Key2", Value: "Value2" });
    });

    test("does nothing with empty tags array", () => {
      // Arrange
      const app = new cdk.App();
      const stack = new cdk.Stack(app, "TestStack");
      const bucket = new s3.Bucket(stack, "TestBucket", {
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
      });

      // Act
      TaggingUtils.applyTagsToResource(bucket, []);

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties("AWS::S3::Bucket", {});
    });

    test("does nothing with undefined tags", () => {
      // Arrange
      const app = new cdk.App();
      const stack = new cdk.Stack(app, "TestStack");
      const bucket = new s3.Bucket(stack, "TestBucket", {
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
      });

      // Act
      TaggingUtils.applyTagsToResource(bucket, undefined);

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties("AWS::S3::Bucket", {});
    });
  });
});