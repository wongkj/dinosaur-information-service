import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import { LambdaIntegration } from "aws-cdk-lib/aws-apigateway";
import { Construct } from "constructs";
import APIGatewayConstruct from "./constructs/APIGatewayConstruct";
import { LambdaConstruct } from "./constructs/LambdaConstruct";

export class ExpressProxyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
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
      },
    ).returnLambda();

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
