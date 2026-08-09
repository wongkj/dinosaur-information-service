import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { LambdaIntegration } from "aws-cdk-lib/aws-apigateway";
import { Construct } from "constructs";
import APIGatewayConstruct from "./constructs/APIGatewayConstruct";
import { LambdaConstruct } from "./constructs/LambdaConstruct";

interface ExpressProxyStackProps extends cdk.StackProps {
  databaseHost: string;
  databaseName: string;
  databaseReadHost: string;
  lambdaSecurityGroup: ec2.ISecurityGroup;
  databaseSecret: secretsmanager.ISecret;
  vpc: ec2.IVpc;
}

export class ExpressProxyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ExpressProxyStackProps) {
    super(scope, id, props);

    const api = new APIGatewayConstruct(this, "express-proxy-api", {});
    const expressApi = api.returnApi();

    const expressProxyLambda = new LambdaConstruct(
      this,
      "express-proxy-lambda",
      {
        functionName: "express-proxy-lambda",
        entry: path.join(__dirname, "handlers", "express-proxy.ts"),
        handler: "handler",
        description: "Proxies requests to an Express application.",
        environment: {
          DATABASE_HOST: props.databaseHost,
          DATABASE_NAME: props.databaseName,
          DATABASE_PORT: "3306",
          DATABASE_READ_HOST: props.databaseReadHost,
          DATABASE_SECRET_ARN: props.databaseSecret.secretArn,
        },
        securityGroups: [props.lambdaSecurityGroup],
        vpc: props.vpc,
        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      },
    ).returnLambda();

    props.databaseSecret.grantRead(expressProxyLambda);

    const expressResource = expressApi.root.addResource("api");
    const expressIntegration = new LambdaIntegration(expressProxyLambda);

    expressResource.addMethod("ANY", expressIntegration);
    expressResource.addProxy({
      anyMethod: true,
      defaultIntegration: expressIntegration,
    });

    new cdk.CfnOutput(this, "ExpressProxyLambdaName", {
      value: expressProxyLambda.functionName,
    });

    new cdk.CfnOutput(this, "ExpressProxyLambdaArn", {
      value: expressProxyLambda.functionArn,
    });

    new cdk.CfnOutput(this, "ExpressApiBaseUrl", {
      value: expressApi.url,
    });

    new cdk.CfnOutput(this, "ExpressProxyApiUrl", {
      value: `${expressApi.url}api`,
    });
  }
}
