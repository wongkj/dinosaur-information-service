import { Readable } from "node:stream";
import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
  ScheduledEvent,
} from "aws-lambda";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import fetch from "node-fetch";
import { BadRequestError } from "../types/errors";

const PALEO_BIO_DB_URL = "https://paleobiodb.org";
const OUTPUT_FILE_NAME = "pbdb_all_occurrences.csv";

const s3Client = new S3Client({});

function toReadableStream(streamBody: unknown): Readable {
  if (streamBody instanceof Readable) {
    return streamBody;
  }

  return Readable.fromWeb(streamBody as globalThis.ReadableStream);
}

async function readableToBuffer(streamBody: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];

  for await (const chunk of streamBody) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

async function fetchAndStoreDinosaurData() {
  const bucketName = process.env.DINO_DATA_BUCKET;

  if (!bucketName) {
    throw new Error("DINO_DATA_BUCKET environment variable is required.");
  }

  const response = await fetch(PALEO_BIO_DB_URL, {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch dinosaur data: ${response.status} ${response.statusText}`,
    );
  }

  if (!response.body) {
    throw new Error("PaleoBioDB response did not include a body stream.");
  }

  const responseBodyStream = toReadableStream(response.body);
  const responseBody = await readableToBuffer(responseBodyStream);

  await s3Client.send(
    new PutObjectCommand({
      Body: responseBody,
      Bucket: bucketName,
      ContentLength: responseBody.byteLength,
      ContentType:
        response.headers.get("content-type") ?? "text/csv; charset=utf-8",
      Key: OUTPUT_FILE_NAME,
    }),
  );

  return {
    bucketName,
    key: OUTPUT_FILE_NAME,
    sourceUrl: PALEO_BIO_DB_URL,
  };
}

export async function handler(
  event: APIGatewayProxyEvent | ScheduledEvent,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  context: Context,
): Promise<APIGatewayProxyResult | { message: string }> {
  if ("httpMethod" in event) {
    if (event.httpMethod !== "GET")
      throw new BadRequestError("Request needs to be GET method.");

    const uploadResult = await fetchAndStoreDinosaurData();

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Dinosaur information downloaded and stored successfully.",
        ...uploadResult,
      }),
    };
  }

  console.log(`scheduled event: ${JSON.stringify(event, null, 2)}`);

  const uploadResult = await fetchAndStoreDinosaurData();

  return {
    message: "Dinosaur information cron job ran successfully.",
    ...uploadResult,
  };
}
