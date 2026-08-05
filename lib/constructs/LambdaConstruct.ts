import { Duration } from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { LambdaIntegration, RestApi } from "aws-cdk-lib/aws-apigateway";
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
  timeout?: Duration;
  api?: RestApi;
  apiResource?: string;
  apiMethod?: string;
}

export class LambdaConstruct extends Construct {
  public readonly function: NodejsFunction;

  constructor(scope: Construct, id: string, props: LambdaConstructProps) {
    super(scope, id);

    this.function = new NodejsFunction(this, "Function", {
      functionName: props.functionName,
      description: props.description,
      runtime: props.runtime ?? lambda.Runtime.NODEJS_22_X,
      entry: props.entry,
      handler: props.handler ?? "index.handler",
      environment: props.environment,
      memorySize: props.memorySize ?? 256,
      timeout: props.timeout ?? Duration.seconds(30),
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
