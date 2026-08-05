import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from "aws-lambda";
import { BadRequestError } from "../types/errors";

export async function handler(
  event: APIGatewayProxyEvent,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  context: Context,
): Promise<APIGatewayProxyResult> {
  if (event.httpMethod !== "GET")
    throw new BadRequestError("Request needs to be GET method.");
  console.log(
    `request: ${JSON.stringify(
      {
        path: event.path,
        queryStringParameters: event.queryStringParameters,
      },
      null,
      2,
    )}`,
  );

  return {
    statusCode: 200,
    body: "Hello World!",
  };
}
