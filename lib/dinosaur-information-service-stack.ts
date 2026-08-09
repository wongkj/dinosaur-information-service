import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import { LambdaIntegration } from "aws-cdk-lib/aws-apigateway";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as rds from "aws-cdk-lib/aws-rds";
import * as scheduler from "aws-cdk-lib/aws-scheduler";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import APIGatewayConstruct from "./constructs/APIGatewayConstruct";
import { LambdaConstruct } from "./constructs/LambdaConstruct";

export class DinosaurInformationServiceStack extends cdk.Stack {
  public readonly applicationSecurityGroup: ec2.SecurityGroup;
  public readonly databaseName: string;
  public readonly databaseSecurityGroup: ec2.SecurityGroup;
  public readonly databaseSecret: secretsmanager.ISecret;
  public readonly mysqlPrimaryInstance: rds.DatabaseInstance;
  public readonly mysqlReadReplica: rds.DatabaseInstanceReadReplica;
  public readonly vpc: ec2.Vpc;

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
    this.databaseName = "dinosaurinformation";

    this.vpc = new ec2.Vpc(this, "dinosaur-service-vpc", {
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

    this.databaseSecurityGroup = new ec2.SecurityGroup(
      this,
      "dinosaur-database-security-group",
      {
        vpc: this.vpc,
        description: "Security group for dinosaur MySQL RDS instances.",
        allowAllOutbound: true,
      },
    );

    this.applicationSecurityGroup = new ec2.SecurityGroup(
      this,
      "dinosaur-application-security-group",
      {
        vpc: this.vpc,
        description:
          "Security group for application Lambdas that access MySQL.",
        allowAllOutbound: true,
      },
    );

    this.databaseSecurityGroup.addIngressRule(
      this.applicationSecurityGroup,
      ec2.Port.tcp(3306),
      "Allow application Lambdas to connect to MySQL.",
    );

    const databaseSubnetGroup = new rds.SubnetGroup(
      this,
      "dinosaur-database-subnet-group",
      {
        description: "Subnet group for dinosaur MySQL RDS instances.",
        vpc: this.vpc,
        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      },
    );

    this.mysqlPrimaryInstance = new rds.DatabaseInstance(
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
        vpc: this.vpc,
        subnetGroup: databaseSubnetGroup,
        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        securityGroups: [this.databaseSecurityGroup],
        credentials: rds.Credentials.fromGeneratedSecret("admin"),
        databaseName: this.databaseName,
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

    if (!this.mysqlPrimaryInstance.secret) {
      throw new Error("Expected the MySQL primary instance to have a secret.");
    }

    this.databaseSecret = this.mysqlPrimaryInstance.secret;

    this.mysqlReadReplica = new rds.DatabaseInstanceReadReplica(
      this,
      "dinosaur-mysql-read-replica",
      {
        sourceDatabaseInstance: this.mysqlPrimaryInstance,
        instanceType: ec2.InstanceType.of(
          ec2.InstanceClass.T3,
          ec2.InstanceSize.MICRO,
        ),
        vpc: this.vpc,
        subnetGroup: databaseSubnetGroup,
        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        securityGroups: [this.databaseSecurityGroup],
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
      value: this.mysqlPrimaryInstance.dbInstanceEndpointAddress,
    });

    new cdk.CfnOutput(this, "MysqlPrimaryEndpointPort", {
      value: this.mysqlPrimaryInstance.dbInstanceEndpointPort,
    });

    new cdk.CfnOutput(this, "MysqlReadReplicaEndpointAddress", {
      value: this.mysqlReadReplica.dbInstanceEndpointAddress,
    });

    new cdk.CfnOutput(this, "MysqlReadReplicaEndpointPort", {
      value: this.mysqlReadReplica.dbInstanceEndpointPort,
    });

    new cdk.CfnOutput(this, "MysqlDatabaseName", {
      value: this.databaseName,
    });

    new cdk.CfnOutput(this, "MysqlCredentialsSecretArn", {
      value: this.databaseSecret.secretArn,
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
