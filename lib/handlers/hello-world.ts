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
  if (!event || !event.body)
    throw new BadRequestError("A Request body was not provided.");

  const { body } = event;

  console.log(`body: ${JSON.stringify(body, null, 2)}`);

  return {
    statusCode: 200,
    body: "Hello World!",
  };
}
