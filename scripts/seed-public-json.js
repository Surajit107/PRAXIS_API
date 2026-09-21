/**
 * Seeds public JSON datasets from `src/json/` into `public_json_docs`.
 * Usage: npm run db:seed:public
 *
 * Required before Postgres-backed public APIs (legacy + world industry
 * collections) return data.
 * YouTube uses static file JSON imports and is not part of this seed.
 */

import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { seedPublicJson } from "../src/seeds/public-json.seeds.js";

config({ path: ".env" });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1 });
const db = drizzle(sql);

try {
  console.log("Seeding public JSON into public_json_docs…");
  const total = await seedPublicJson(db, {
    onCollection: (collection, count) => {
      console.log(`  ${collection}: ${count}`);
    },
  });
  console.log(`Done. Total rows: ${total}`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
