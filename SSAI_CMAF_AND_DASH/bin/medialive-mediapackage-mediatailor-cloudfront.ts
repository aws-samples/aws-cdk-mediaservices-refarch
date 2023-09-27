#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { Aws} from "aws-cdk-lib";
import { MedialiveMediapackageMediaTailorCloudfrontStack } from '../lib/medialive-mediapackage-mediatailor-cloudfront-stack';

import { App, Aspects } from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';

const app = new cdk.App();
const stackName=app.node.tryGetContext('stackName')
const description=app.node.tryGetContext('stackDescription')

//Aspects.of(app).add(new AwsSolutionsChecks());
new MedialiveMediapackageMediaTailorCloudfrontStack(app, 'MedialiveMediapackageMediaTailorCloudfrontStack', {
  stackName: stackName,
  env: {
    region: `${Aws.REGION}`,
    account: `${Aws.ACCOUNT_ID}`,
  },
  description
});