import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL ?? "postgres://lagan:lagan@localhost:5432/lagan";

export default defineConfig({
  dialect: "postgresql",
  schema: "./packages/db/src/schema/!(*.test).ts",
  out: "./packages/db/drizzle",
  dbCredentials: { url: databaseUrl },
  strict: true,
  verbose: true,
});
