import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema.js";

export function createDbClient(databaseUrl: string) {
  const sql = neon(databaseUrl);
  return drizzle(sql, { schema });
}

export type DbClient = ReturnType<typeof createDbClient>;

export function getDb(databaseUrl?: string): DbClient {
  const url =
    databaseUrl ||
    process.env.DATABASE_URL ||
    "postgres://localhost:5432/ocafy";
  return createDbClient(url);
}

export const db = getDb();
