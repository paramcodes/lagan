import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { DEFAULT_DATABASE_URL, logDatabaseTarget, resolveDatabaseUrl } from "./env";

const database = resolveDatabaseUrl({ defaultUrl: DEFAULT_DATABASE_URL });
logDatabaseTarget(database);

const pool = new Pool({
  connectionString: database.url,
});
export const db = drizzle(pool);
