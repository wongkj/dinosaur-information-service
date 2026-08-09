import { Duration } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { LambdaIntegration, RestApi } from "aws-cdk-lib/aws-apigateway";
import * as logs from "aws-cdk-lib/aws-logs";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";

export interface LambdaConstructProps {
  functionName: string;
  entry: string;
  description?: string;
  environment?: Record<string, string>;
  handler?: string;
  memorySize?: number;
  runtime?: lambda.Runtime;
  securityGroups?: ec2.ISecurityGroup[];
  timeout?: Duration;
  api?: RestApi;
  apiResource?: string;
  apiMethod?: string;
  vpc?: ec2.IVpc;
  vpcSubnets?: ec2.SubnetSelection;
}

export class LambdaConstruct extends Construct {
  public readonly function: NodejsFunction;

  constructor(scope: Construct, id: string, props: LambdaConstructProps) {
    super(scope, id);

    const functionLogGroup = logs.LogGroup.fromLogGroupName(
      this,
      "FunctionLogGroup",
      `/aws/lambda/${props.functionName}`,
    );

    this.function = new NodejsFunction(this, "Function", {
      functionName: props.functionName,
      description: props.description,
      runtime: props.runtime ?? lambda.Runtime.NODEJS_22_X,
      entry: props.entry,
      handler: props.handler ?? "index.handler",
      environment: props.environment,
      logGroup: functionLogGroup,
      memorySize: props.memorySize ?? 256,
      securityGroups: props.securityGroups,
      timeout: props.timeout ?? Duration.seconds(30),
      vpc: props.vpc,
      vpcSubnets: props.vpcSubnets,
    });

    new cdk.CfnOutput(this, `${id}-functionName`, {
      value: this.function.functionName,
    });

    if (props.api!) {
      this.integrateLambdaWithApi(
        this.function,
        props.api!,
        props.apiResource!,
        props.apiMethod!,
      );
    }
  }

  private integrateLambdaWithApi(
    lambdaFunction: lambda.IFunction,
    api: RestApi,
    apiResource: string,
    apiMethod: string,
  ) {
    const lambdaIntegration = new LambdaIntegration(lambdaFunction);
    const lambdaResource = api.root.addResource(apiResource);
    lambdaResource.addMethod(apiMethod, lambdaIntegration);
  }

  public returnLambda() {
    return this.function;
  }
}
