import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as kinesis from "aws-cdk-lib/aws-kinesis";
import * as kinesisFirehose from "aws-cdk-lib/aws-kinesisfirehose";
import * as iot from "aws-cdk-lib/aws-iot";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";

interface Props extends cdk.StackProps {
  projectName: string;
}

export class IotKinesisDataStreamSampleStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);
    console.log("IotKinesisDataStreamSampleStack");
    const { projectName } = props;
    const streamName = `${projectName}-Stream`;
    const ioTTopicRuleName = `${projectName}_TopicRule`;
    const logGroupName = `${projectName}-FirehoseLogGroup`;
    const logStreamName = `${projectName}-FirehoseLogStream`;

    // S3 Bucket
    const bucketName = camelCaseToKebabCase(projectName);
    const bucket = new s3.Bucket(this, `${projectName}-Bucket`, {
      bucketName,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Lambda Function Role
    const lambdaRole = new iam.Role(this, `${projectName}-LambdaRole`, {
      roleName: `${projectName}-LambdaRole`,
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSLambdaBasicExecutionRole",
        ),
      ],
    });

    // Lambda Function

    const lambdaFunction = new lambda.Function(
      this,
      `${projectName}-LambdaFunction`,
      {
        functionName: `${projectName}-LambdaFunction`,
        runtime: lambda.Runtime.NODEJS_20_X,
        code: lambda.Code.fromAsset("lambda"),
        handler: "index.handler",
        role: lambdaRole,
      },
    );

    // Kinesis Data Stream
    const stream = new kinesis.Stream(this, `${projectName}-Stream`, {
      streamName,
      shardCount: 1,
    });

    // IoT Topic Rule Role

    const iotTopicRuleRole = new iam.Role(
      this,
      `${projectName}-TopicRuleRole`,
      {
        roleName: `${projectName}-TopicRuleRole`,
        assumedBy: new iam.ServicePrincipal("iot.amazonaws.com"),
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName(
            "service-role/AWSIoTRuleActions",
          ),
        ],
      },
    );

    iotTopicRuleRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["kinesis:PutRecord"],
        resources: [stream.streamArn],
      }),
    );

    // IoT Topic Rule
    new iot.CfnTopicRule(this, `${projectName}-TopicRule`, {
      ruleName: ioTTopicRuleName,
      topicRulePayload: {
        actions: [
          {
            kinesis: {
              streamName,
              roleArn: iotTopicRuleRole.roleArn,
            },
          },
        ],
        sql: `SELECT * FROM '#'`,
      },
    });

    // Kinesis Data Firehose Role
    const firehoseRole = new iam.Role(this, `${projectName}-FirehoseRole`, {
      roleName: `${projectName}-FirehoseRole`,
      assumedBy: new iam.ServicePrincipal("firehose.amazonaws.com"),
      inlinePolicies: {
        firehosePolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ["s3:PutObject"],
              resources: [`${bucket.bucketArn}/*`],
            }),
            new iam.PolicyStatement({
              actions: [
                "kinesis:DescribeStream",
                "kinesis:GetShardIterator",
                "kinesis:GetRecords",
                "kinesis:ListShards",
              ],
              resources: [stream.streamArn],
            }),
            new iam.PolicyStatement({
              actions: ["lambda:InvokeFunction"],
              resources: [lambdaFunction.functionArn],
            }),
            new iam.PolicyStatement({
              actions: ["logs:PutLogEvents"],
              resources: [
                `arn:aws:logs:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:log-group:${logGroupName}:log-stream:${logStreamName}`,
              ],
            }),
          ],
        }),
      },
    });

    // Log Stream for Kinesis Data Firehose
    new logs.LogStream(this, `${projectName}-FirehoseLogStream`, {
      logStreamName,
      logGroup: new logs.LogGroup(this, `${projectName}-FirehoseLogGroup`, {
        logGroupName,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
    });

    // Kinesis Data Firehose

    new kinesisFirehose.CfnDeliveryStream(this, `${projectName}-Firehose`, {
      deliveryStreamType: "KinesisStreamAsSource",
      kinesisStreamSourceConfiguration: {
        kinesisStreamArn: stream.streamArn,
        roleArn: firehoseRole.roleArn,
      },
      extendedS3DestinationConfiguration: {
        bucketArn: bucket.bucketArn,
        roleArn: firehoseRole.roleArn,
        processingConfiguration: {
          enabled: true,
          processors: [
            {
              type: "Lambda",
              parameters: [
                {
                  parameterName: "LambdaArn",
                  parameterValue: lambdaFunction.functionArn,
                },
              ],
            },
          ],
        },
        cloudWatchLoggingOptions: {
          enabled: true,
          logGroupName,
          logStreamName,
        },
      },
    });
  }
}

const camelCaseToKebabCase = (str: string) => {
  // Convert the first uppercase letter to lowercase
  str = str.charAt(0).toLowerCase() + str.slice(1);
  // Convert camelCase to kebab-case
  return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, "$1-$2").toLowerCase();
};
