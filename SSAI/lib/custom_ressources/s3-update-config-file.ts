import {
    custom_resources,
    aws_iam as iam,
    aws_s3 as s3,
    Aws
  } from "aws-cdk-lib";
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag';


  
export interface MyCustomResourceProps {
    sessionURLHls: string;
    sessionURLDash: string;
    s3Bucket: s3.Bucket;
}

export class UpdateDemoWebsite extends Construct {
  public readonly response: string;

  constructor(scope: Construct, id: string, props: MyCustomResourceProps) {
    super(scope, id);

    /*
    * Updating the config file for the DemoWebsite 👇
    */
    const jsonconfig = {
        "sessionURLHls":`${props.sessionURLHls}`,
        "sessionURLDash":`${props.sessionURLDash}`
    };
    const updateConfigFile = new custom_resources.AwsCustomResource(
        this,
        "WriteS3ConfigFile",
        {
        onUpdate: {
            service: "S3",
            action: "putObject",
            parameters: {
            Body: JSON.stringify(jsonconfig),
            Bucket: `${props.s3Bucket.bucketName}`,
            Key: 'config.json',
            },
            region: Aws.REGION,
            physicalResourceId: custom_resources.PhysicalResourceId.of(Date.now().toString())
        },
        policy: custom_resources.AwsCustomResourcePolicy.fromStatements([
            new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["s3:PutObject"],
            resources: [`${props.s3Bucket.bucketArn}/config.json`],
            }),
        ]),
        }
    );
  }
}