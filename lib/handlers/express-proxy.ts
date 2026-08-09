import serverlessExpress from "@codegenie/serverless-express";
import express, { type Request, type Response } from "express";
import { verifyDatabaseConnection } from "../db/drizzle";

const app = express();

app.use(express.json());

app.get("/", (_request: Request, response: Response) => {
  response.json({
    message: "Express proxy endpoint is running.",
  });
});

app.get("/health", (_request: Request, response: Response) => {
  response.json({
    status: "ok",
  });
});

app.get("/good-bye-world", (_request: Request, response: Response) => {
  response.json({
    status: "ok",
    message: "Goodbye World!",
  });
});

app.get("/db-health", async (request: Request, response: Response) => {
  const requestedTarget = request.query.target;
  const target = requestedTarget === "read" ? "read" : "primary";

  const connection = await verifyDatabaseConnection(target);

  response.json({
    status: "ok",
    ...connection,
  });
});

app.all("/*path", (request: Request, response: Response) => {
  response.json({
    headers: request.headers,
    method: request.method,
    path: request.path,
    query: request.query,
  });
});

export const handler = serverlessExpress({ app });
