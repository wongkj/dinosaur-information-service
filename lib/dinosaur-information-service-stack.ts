import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import { LambdaIntegration } from "aws-cdk-lib/aws-apigateway";
import { Construct } from "constructs";
import APIGatewayConstruct from "./constructs/APIGatewayConstruct";
import { LambdaConstruct } from "./constructs/LambdaConstruct";

export class DinosaurInformationServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const api = new APIGatewayConstruct(this, "dinosaur-info-api", {});
    const getDinoInfoApi = api.returnApi();

    const helloWorldLambda = new LambdaConstruct(this, "hello-world-lambda", {
      functionName: "hello-world-lambda",
      entry: path.join(__dirname, "handlers", "hello-world.ts"),
      handler: "handler",
      description: "Returns dinosaur information.",
      api: getDinoInfoApi,
      apiResource: "hello-world",
      apiMethod: "GET",
    }).returnLambda();

    const expressProxyLambda = new LambdaConstruct(
      this,
      "express-proxy-lambda",
      {
        functionName: "express-proxy-lambda",
        entry: path.join(__dirname, "handlers", "express-proxy.ts"),
        handler: "handler",
        description: "Proxies requests to an Express application.",
      },
    ).returnLambda();

    getDinoInfoApi.root.addMethod(
      "GET",
      new LambdaIntegration(helloWorldLambda),
    );

    const expressResource = getDinoInfoApi.root.addResource("/api");
    const expressIntegration = new LambdaIntegration(expressProxyLambda);

    expressResource.addMethod("ANY", expressIntegration);
    expressResource.addProxy({
      anyMethod: true,
      defaultIntegration: expressIntegration,
    });

    new cdk.CfnOutput(this, "HelloWorldLambdaName", {
      value: helloWorldLambda.functionName,
    });

    new cdk.CfnOutput(this, "HelloWorldLambdaArn", {
      value: helloWorldLambda.functionArn,
    });

    new cdk.CfnOutput(this, "ExpressProxyLambdaName", {
      value: expressProxyLambda.functionName,
    });

    new cdk.CfnOutput(this, "ExpressProxyLambdaArn", {
      value: expressProxyLambda.functionArn,
    });

    new cdk.CfnOutput(this, "ApiBaseUrl", {
      value: getDinoInfoApi.url,
    });

    new cdk.CfnOutput(this, "HelloWorldApiUrl", {
      value: `${getDinoInfoApi.url}hello-world`,
    });

    new cdk.CfnOutput(this, "ExpressProxyApiUrl", {
      value: `${getDinoInfoApi.url}express`,
    });
  }
}
