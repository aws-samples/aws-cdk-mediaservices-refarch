#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { Aws} from "aws-cdk-lib";
import { App, Aspects } from 'aws-cdk-lib';

import { AwsSolutionsChecks } from 'cdk-nag';

import { MedialiveMediapackageCloudfrontStack } from '../lib/medialive-mediapackage-cloudfront-stack';
const stackNameValue='MediaServicesRefArch-OTT'
const description = "AWS CDK MediaServices Reference Architectures: Live OTT workflow. CDK demo using AWS MediaLive, MediaPackage and Amazon CloudFront."

const app = new cdk.App();
//Aspects.of(app).add(new AwsSolutionsChecks());
new MedialiveMediapackageCloudfrontStack(app, 'MedialiveMediapackageCloudfrontStack', {
  stackName: stackNameValue,
  env: {
    region: `${Aws.REGION}`,
    account: `${Aws.ACCOUNT_ID}`,
  },
  description
});