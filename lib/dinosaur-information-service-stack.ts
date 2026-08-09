import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import { LambdaIntegration } from "aws-cdk-lib/aws-apigateway";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as rds from "aws-cdk-lib/aws-rds";
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
    const databaseName = "dinosaurinformation";

    const vpc = new ec2.Vpc(this, "dinosaur-service-vpc", {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          name: "public",
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          name: "private",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });

    const databaseSecurityGroup = new ec2.SecurityGroup(
      this,
      "dinosaur-database-security-group",
      {
        vpc,
        description: "Security group for dinosaur MySQL RDS instances.",
        allowAllOutbound: true,
      },
    );

    const databaseSubnetGroup = new rds.SubnetGroup(
      this,
      "dinosaur-database-subnet-group",
      {
        description: "Subnet group for dinosaur MySQL RDS instances.",
        vpc,
        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      },
    );

    const mysqlPrimaryInstance = new rds.DatabaseInstance(
      this,
      "dinosaur-mysql-primary",
      {
        engine: rds.DatabaseInstanceEngine.mysql({
          version: rds.MysqlEngineVersion.VER_8_0_43,
        }),
        instanceType: ec2.InstanceType.of(
          ec2.InstanceClass.T3,
          ec2.InstanceSize.MICRO,
        ),
        vpc,
        subnetGroup: databaseSubnetGroup,
        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        securityGroups: [databaseSecurityGroup],
        credentials: rds.Credentials.fromGeneratedSecret("admin"),
        databaseName,
        multiAz: false,
        allocatedStorage: 20,
        maxAllocatedStorage: 100,
        backupRetention: cdk.Duration.days(7),
        deletionProtection: false,
        publiclyAccessible: false,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        deleteAutomatedBackups: true,
      },
    );

    const mysqlReadReplica = new rds.DatabaseInstanceReadReplica(
      this,
      "dinosaur-mysql-read-replica",
      {
        sourceDatabaseInstance: mysqlPrimaryInstance,
        instanceType: ec2.InstanceType.of(
          ec2.InstanceClass.T3,
          ec2.InstanceSize.MICRO,
        ),
        vpc,
        subnetGroup: databaseSubnetGroup,
        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        securityGroups: [databaseSecurityGroup],
        publiclyAccessible: false,
        deletionProtection: false,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        deleteAutomatedBackups: true,
      },
    );

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

    new cdk.CfnOutput(this, "MysqlPrimaryEndpointAddress", {
      value: mysqlPrimaryInstance.dbInstanceEndpointAddress,
    });

    new cdk.CfnOutput(this, "MysqlPrimaryEndpointPort", {
      value: mysqlPrimaryInstance.dbInstanceEndpointPort,
    });

    new cdk.CfnOutput(this, "MysqlReadReplicaEndpointAddress", {
      value: mysqlReadReplica.dbInstanceEndpointAddress,
    });

    new cdk.CfnOutput(this, "MysqlReadReplicaEndpointPort", {
      value: mysqlReadReplica.dbInstanceEndpointPort,
    });

    new cdk.CfnOutput(this, "MysqlDatabaseName", {
      value: databaseName,
    });

    if (mysqlPrimaryInstance.secret) {
      new cdk.CfnOutput(this, "MysqlCredentialsSecretArn", {
        value: mysqlPrimaryInstance.secret.secretArn,
      });
    }

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
