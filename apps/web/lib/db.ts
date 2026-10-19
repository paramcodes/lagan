import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://lagan:lagan@localhost:5432/lagan",
});
export const db = drizzle(pool);