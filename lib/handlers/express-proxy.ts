import serverlessExpress from "@codegenie/serverless-express";
import express, { type Request, type Response } from "express";

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

app.all("*", (request: Request, response: Response) => {
  response.json({
    headers: request.headers,
    method: request.method,
    path: request.path,
    query: request.query,
  });
});

export const handler = serverlessExpress({ app });
