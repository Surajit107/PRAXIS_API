/**
 * Docker / compose boot helper:
 * 1. Retry until Postgres accepts connections
 * 2. Apply Drizzle migrations (same `drizzle/` folder as `npm run db:migrate`)
 *
 * Uses drizzle-orm's migrator (runtime dep) so the image can omit drizzle-kit.
 */

import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import path from "path";
import postgres from "postgres";
import { fileURLToPath } from "url";

config({ path: ".env" });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const isRemotePostgresUrl = (url) => {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host !== "localhost" && host !== "127.0.0.1" && host !== "::1";
  } catch {
    return false;
  }
};

const sslOpts = isRemotePostgresUrl(databaseUrl) ? { ssl: "require" } : {};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForPostgres = async (maxAttempts = 30, delayMs = 2000) => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const sql = postgres(databaseUrl, {
      max: 1,
      prepare: false,
      connect_timeout: 5,
      ...sslOpts,
    });
    try {
      await sql`select 1`;
      await sql.end({ timeout: 5 });
      console.log(`Postgres ready (attempt ${attempt}/${maxAttempts})`);
      return;
    } catch (error) {
      await sql.end({ timeout: 1 }).catch(() => { });
      console.warn(
        `Waiting for Postgres (${attempt}/${maxAttempts}): ${error.message}`
      );
      if (attempt === maxAttempts) {
        throw new Error(
          `Postgres not ready after ${maxAttempts} attempts: ${error.message}`
        );
      }
      await sleep(delayMs);
    }
  }
};

const runMigrate = async () => {
  const sql = postgres(databaseUrl, {
    max: 1,
    prepare: false,
    ...sslOpts,
  });
  const db = drizzle(sql);
  const migrationsFolder = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "drizzle"
  );

  console.log(`Applying migrations from ${migrationsFolder}`);
  await migrate(db, { migrationsFolder });
  await sql.end({ timeout: 5 });
  console.log("Migrations applied");
};

try {
  await waitForPostgres();
  await runMigrate();
} catch (error) {
  console.error("docker-boot failed:", error);
  process.exit(1);
}
