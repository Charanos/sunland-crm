import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/db/schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl && process.env.NODE_ENV === "production") {
  throw new Error("DATABASE_URL is required in production");
}

const sql = neon(databaseUrl ?? "postgresql://local:local@localhost:5432/sunland");

export const db = drizzle(sql, { schema });
