import { defineConfig } from "drizzle-kit";

// As migrations usam a conexão direta (sem pooler): DATABASE_URL_UNPOOLED.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "",
  },
  // O schema `neon_auth` pertence ao Neon Auth: nunca mexer.
  schemaFilter: ["public"],
});
