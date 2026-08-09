import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import { LambdaIntegration } from "aws-cdk-lib/aws-apigateway";
import * as iam from "aws-cdk-lib/aws-iam";
import * as scheduler from "aws-cdk-lib/aws-scheduler";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import APIGatewayConstruct from "./constructs/APIGatewayConstruct";
import { LambdaConstruct } from "./constructs/LambdaConstruct";

export class DinosaurInformationServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const dinosaurInformationScheduleExpression = String(
      process.env.DINO_INFO_SCHEDULE ?? "cron(30 5 * * ? *)",
    );
    const stage = String(process.env.STAGE ?? "dev").toLowerCase();
    const dinosaurDataBucketBaseName = String(
      process.env.DINO_DATA_BUCKET ?? "dino-data",
    ).toLowerCase();
    const dinosaurDataBucketName = `${stage}-${dinosaurDataBucketBaseName}`;

    const api = new APIGatewayConstruct(this, "dinosaur-info-api", {});
    const getDinoInfoApi = api.returnApi();

    const dinosaurDataBucket = new s3.Bucket(this, "dinosaur-data-bucket", {
      bucketName: dinosaurDataBucketName,
      versioned: true,
    });

    const helloWorldLambda = new LambdaConstruct(this, "hello-world-lambda", {
      functionName: "hello-world-lambda",
      entry: path.join(__dirname, "handlers", "hello-world.ts"),
      handler: "handler",
      description: "Returns dinosaur information.",
      api: getDinoInfoApi,
      apiResource: "hello-world",
      apiMethod: "GET",
    }).returnLambda();

    const dinosaurInformationLambda = new LambdaConstruct(
      this,
      "dinosaur-information-lambda",
      {
        functionName: "dinosaur-information-lambda",
        entry: path.join(__dirname, "handlers", "dinosaur-information.ts"),
        handler: "handler",
        description: "Returns dinosaur information.",
        environment: {
          DINO_DATA_BUCKET: dinosaurDataBucket.bucketName,
        },
        memorySize: 1024,
        timeout: cdk.Duration.minutes(15),
        api: getDinoInfoApi,
        apiResource: "dinosaur-information",
        apiMethod: "GET",
      },
    ).returnLambda();

    getDinoInfoApi.root.addMethod(
      "GET",
      new LambdaIntegration(helloWorldLambda),
    );

    const dinosaurInformationScheduleRole = new iam.Role(
      this,
      "dinosaur-information-schedule-role",
      {
        assumedBy: new iam.ServicePrincipal("scheduler.amazonaws.com"),
      },
    );

    dinosaurInformationLambda.grantInvoke(dinosaurInformationScheduleRole);
    dinosaurDataBucket.grantReadWrite(dinosaurInformationLambda);

    const dinosaurInformationSchedule = new scheduler.CfnSchedule(
      this,
      "dinosaur-information-daily-schedule",
      {
        flexibleTimeWindow: {
          mode: "OFF",
        },
        scheduleExpression: dinosaurInformationScheduleExpression,
        scheduleExpressionTimezone: "Australia/Melbourne",
        target: {
          arn: dinosaurInformationLambda.functionArn,
          roleArn: dinosaurInformationScheduleRole.roleArn,
        },
      },
    );

    new cdk.CfnOutput(this, "HelloWorldLambdaName", {
      value: helloWorldLambda.functionName,
    });

    new cdk.CfnOutput(this, "HelloWorldLambdaArn", {
      value: helloWorldLambda.functionArn,
    });

    new cdk.CfnOutput(this, "DinosaurInformationLambdaName", {
      value: dinosaurInformationLambda.functionName,
    });

    new cdk.CfnOutput(this, "DinosaurInformationLambdaArn", {
      value: dinosaurInformationLambda.functionArn,
    });

    new cdk.CfnOutput(this, "DinosaurInformationScheduleName", {
      value:
        dinosaurInformationSchedule.name ??
        "dinosaur-information-daily-schedule",
    });

    new cdk.CfnOutput(this, "DinosaurDataBucketName", {
      value: dinosaurDataBucket.bucketName,
    });

    new cdk.CfnOutput(this, "DinosaurDataBucketArn", {
      value: dinosaurDataBucket.bucketArn,
    });

    new cdk.CfnOutput(this, "ApiBaseUrl", {
      value: getDinoInfoApi.url,
    });

    new cdk.CfnOutput(this, "HelloWorldApiUrl", {
      value: `${getDinoInfoApi.url}hello-world`,
    });

    new cdk.CfnOutput(this, "DinosaurInformationApiUrl", {
      value: `${getDinoInfoApi.url}dinosaur-information`,
    });
  }
}
