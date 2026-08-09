import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "mysql://root:password@localhost:3306/dinosaurinformation",
  },
  dialect: "mysql",
  out: "./drizzle",
  schema: "./lib/db/schema.ts",
});
