import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "@/db/schema";
import * as relations from "@/db/relations";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl && process.env.NODE_ENV === "production") {
  throw new Error("DATABASE_URL is required in production");
}

// Always use the websocket pool driver, in production too - the stateless
// neon-http client's db.transaction() unconditionally throws ("No
// transactions support in neon-http driver"), and most services here rely
// on real transactions for multi-statement writes.
neonConfig.webSocketConstructor = ws;
const pool = new Pool({
  connectionString: databaseUrl ?? "postgresql://local:local@localhost:5432/sunland",
});
const dbInstance = drizzle(pool, { schema: { ...schema, ...relations } });

export type DbClient = typeof dbInstance;
export const db = dbInstance;



