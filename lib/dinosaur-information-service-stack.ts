import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import APIGatewayConstruct from "./constructs/APIGatewayConstruct";
import { LambdaConstruct } from "./constructs/LambdaConstruct";

export class DinosaurInformationServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const api = new APIGatewayConstruct(this, "file-reader-api", {});
    const getDinoInfoApi = api.returnApi();

    const helloWorldLambda = new LambdaConstruct(this, "hello-world-lambda", {
      functionName: "hello-world-lambda",
      codePath: path.join(__dirname, "handlers"),
      handler: "hello-world.handler",
      description: "Returns dinosaur information.",
      api: getDinoInfoApi,
      apiResource: "hello-world",
      apiMethod: "GET",
    }).returnLambda();

    new cdk.CfnOutput(this, "HelloWorldLambdaName", {
      value: helloWorldLambda.functionName,
    });

    new cdk.CfnOutput(this, "HelloWorldLambdaArn", {
      value: helloWorldLambda.functionArn,
    });
  }
}
