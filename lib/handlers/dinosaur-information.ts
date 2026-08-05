import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
  ScheduledEvent,
} from "aws-lambda";
import { BadRequestError } from "../types/errors";

export async function handler(
  event: APIGatewayProxyEvent | ScheduledEvent,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  context: Context,
): Promise<APIGatewayProxyResult | { message: string }> {
  if ("httpMethod" in event) {
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

  console.log(`scheduled event: ${JSON.stringify(event, null, 2)}`);

  return {
    message: "Dinosaur information cron job ran successfully.",
  };
}
