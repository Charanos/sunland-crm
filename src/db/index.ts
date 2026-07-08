import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "@/db/schema";
import * as relations from "@/db/relations";

neonConfig.webSocketConstructor = ws;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl && process.env.NODE_ENV === "production") {
  throw new Error("DATABASE_URL is required in production");
}

const pool = new Pool({
  connectionString: databaseUrl ?? "postgresql://local:local@localhost:5432/sunland",
});

export const db = drizzle(pool, { schema: { ...schema, ...relations } });
