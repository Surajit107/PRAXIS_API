/**
 * Drops every table + enum in the public schema so a fresh Drizzle migrate can run.
 * Usage: npm run db:drop-all
 */

import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env" });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

let isRemote = false;
try {
  const host = new URL(databaseUrl).hostname.toLowerCase();
  isRemote = host !== "localhost" && host !== "127.0.0.1" && host !== "::1";
} catch {
  isRemote = false;
}

const sql = postgres(databaseUrl, {
  max: 1,
  prepare: false,
  ...(isRemote ? { ssl: "require" } : {}),
});

try {
  await sql.unsafe(`
    DO $$ DECLARE
      r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
      FOR r IN (SELECT typname FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typtype = 'e') LOOP
        EXECUTE 'DROP TYPE IF EXISTS public.' || quote_ident(r.typname) || ' CASCADE';
      END LOOP;
    END $$;
  `);
  // Clear migration journal so `db:migrate` re-applies after a full wipe
  await sql.unsafe(`DROP SCHEMA IF EXISTS drizzle CASCADE`);
  console.log("Dropped all public tables/enums and drizzle migration journal.");
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
