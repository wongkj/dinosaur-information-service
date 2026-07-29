import { RestApi } from "aws-cdk-lib/aws-apigateway";
import { Construct } from "constructs";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface CustomAPIGatewayProps {}

export default class APIGatewayConstruct extends Construct {
  private api: RestApi;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(scope: Construct, id: string, props: CustomAPIGatewayProps) {
    super(scope, id);

    this.api = new RestApi(this, id);
  }

  public returnApi() {
    return this.api;
  }
}
