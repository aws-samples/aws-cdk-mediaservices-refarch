#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { Aws} from "aws-cdk-lib";
import { MedialiveMediapackageCloudfrontStack } from '../lib/medialive-mediapackage-cloudfront-stack';
import { AwsSolutionsChecks } from 'cdk-nag';
import { Aspects } from 'aws-cdk-lib';

const app = new cdk.App();
const stackName=app.node.tryGetContext('stackName')
const description=app.node.tryGetContext('stackDescription')

//Aspects.of(app).add(new AwsSolutionsChecks());
new MedialiveMediapackageCloudfrontStack(app, 'MedialiveMediapackageCloudfrontStack', {
  stackName: stackName,
  env: {
    region: `${Aws.REGION}`,
    account: `${Aws.ACCOUNT_ID}`,
  },
  description
});