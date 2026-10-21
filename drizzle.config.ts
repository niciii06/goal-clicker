import { defineConfig } from "drizzle-kit";

// PostgreSQL (Supabase). DATABASE_URL is only needed for `drizzle-kit migrate`, not for `generate`.
export default defineConfig({
  out: "./drizzle",
  schema: "./db/schema.ts",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
