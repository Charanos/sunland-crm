import { Pool, neonConfig, neon } from "@neondatabase/serverless";
import { drizzle as drizzleServerless } from "drizzle-orm/neon-serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import ws from "ws";
import * as schema from "@/db/schema";
import * as relations from "@/db/relations";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl && process.env.NODE_ENV === "production") {
  throw new Error("DATABASE_URL is required in production");
}

let dbInstance;

if (process.env.NODE_ENV === "production") {
  // Use stateless neon HTTP client in production for serverless speed,
  // connection pooling, and robustness against websocket exhaustion.
  const sql = neon(databaseUrl!);
  dbInstance = drizzleHttp(sql, { schema: { ...schema, ...relations } });
} else {
  // Use websocket pool for local development and scripts
  neonConfig.webSocketConstructor = ws;
  const pool = new Pool({
    connectionString: databaseUrl ?? "postgresql://local:local@localhost:5432/sunland",
  });
  dbInstance = drizzleServerless(pool, { schema: { ...schema, ...relations } });
}

// Extract the concrete development database client type to resolve
// union signature mismatch compiler errors while retaining type safety.
const poolDummy = {} as Pool;
const dummyDb = drizzleServerless(poolDummy, { schema: { ...schema, ...relations } });
export type DbClient = typeof dummyDb;

export const db = dbInstance as unknown as DbClient;



