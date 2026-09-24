import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export function createDbClient(databaseUrl: string) {
  const sql = neon(databaseUrl);
  return drizzle(sql, { schema });
}

export type DbClient = ReturnType<typeof createDbClient>;

export function getDb(databaseUrl?: string): DbClient {
  const url = databaseUrl || process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL não definida. Copie .env.example para apps/web/.env.local.",
    );
  }
  return createDbClient(url);
}

let instance: DbClient | undefined;

/**
 * Cliente padrão, criado sob demanda: importar o pacote (build, testes, CI)
 * não exige banco; só a primeira consulta lê DATABASE_URL.
 */
export const db: DbClient = new Proxy({} as DbClient, {
  get(_target, prop) {
    instance ??= getDb();
    const value = Reflect.get(instance, prop);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
