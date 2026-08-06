import { Readable } from "node:stream";
import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
  ScheduledEvent,
} from "aws-lambda";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import axios from "axios";
import { BadRequestError } from "../types/errors";

const PALEO_BIO_DB_URL =
  "https://paleobiodb.org/data1.2/occs/list.csv?all_records";
const OUTPUT_FILE_NAME = "pbdb_all_occurrences.csv";

const s3Client = new S3Client({});

async function fetchAndStoreDinosaurData() {
  const bucketName = process.env.DINO_DATA_BUCKET;

  if (!bucketName) {
    throw new Error("DINO_DATA_BUCKET environment variable is required.");
  }

  const response = await axios({
    method: "GET",
    responseType: "stream",
    timeout: 600000,
    url: PALEO_BIO_DB_URL,
  });

  if (!response.data) {
    throw new Error("PaleoBioDB response did not include a body stream.");
  }

  const responseBodyStream = response.data as Readable;
  const contentTypeHeader = response.headers["content-type"];
  const contentType =
    typeof contentTypeHeader === "string"
      ? contentTypeHeader
      : "text/csv; charset=utf-8";

  const upload = new Upload({
    client: s3Client,
    params: {
      Body: responseBodyStream,
      Bucket: bucketName,
      ContentType: contentType,
      Key: OUTPUT_FILE_NAME,
    },
    partSize: 10 * 1024 * 1024,
    queueSize: 4,
  });

  upload.on("httpUploadProgress", (progress) => {
    console.log(`uploaded bytes: ${progress.loaded ?? 0}`);
  });

  await upload.done();

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
