#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import {IotKinesisDataStreamSampleStack} from '../lib/IotKinesisDataStreamSampleStack';

const app = new cdk.App();
new IotKinesisDataStreamSampleStack(app, 'IotKinesisDataStreamSampleStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  projectName: 'IotKinesisDataStreamSample',

});