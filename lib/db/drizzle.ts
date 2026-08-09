import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

type DatabaseSecret = {
  password: string;
  port?: number | string;
  username: string;
};

const secretsManagerClient = new SecretsManagerClient({});

const cachedPools = new Map<string, mysql.Pool>();

async function getDatabaseSecret(): Promise<DatabaseSecret> {
  const secretArn = process.env.DATABASE_SECRET_ARN;

  if (!secretArn) {
    throw new Error("DATABASE_SECRET_ARN environment variable is required.");
  }

  const response = await secretsManagerClient.send(
    new GetSecretValueCommand({
      SecretId: secretArn,
    }),
  );

  if (!response.SecretString) {
    throw new Error("Database secret was missing SecretString content.");
  }

  return JSON.parse(response.SecretString) as DatabaseSecret;
}

async function getPool(host: string) {
  const databaseName = process.env.DATABASE_NAME;

  if (!databaseName) {
    throw new Error("DATABASE_NAME environment variable is required.");
  }

  const cachedPool = cachedPools.get(host);

  if (cachedPool) {
    return cachedPool;
  }

  const secret = await getDatabaseSecret();

  const pool = mysql.createPool({
    connectionLimit: 1,
    database: databaseName,
    host,
    password: secret.password,
    port: Number(process.env.DATABASE_PORT ?? secret.port ?? 3306),
    user: secret.username,
    waitForConnections: true,
  });

  cachedPools.set(host, pool);

  return pool;
}

export async function verifyDatabaseConnection(target: "primary" | "read") {
  const host =
    target === "read"
      ? process.env.DATABASE_READ_HOST
      : process.env.DATABASE_HOST;

  if (!host) {
    throw new Error(`Missing database host for target: ${target}`);
  }

  const pool = await getPool(host);
  const db = drizzle(pool);

  await db.execute(sql`select 1 as healthy`);

  return {
    database: process.env.DATABASE_NAME,
    host,
    target,
  };
}
