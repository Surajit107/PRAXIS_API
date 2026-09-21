/**
 * Seeds world geo hierarchy into geo_* tables.
 * Usage: npm run db:seed:geo
 *
 * Downloads CSC JSON into data/geo-cache/ on first run (gitignored).
 * For tests / offline, call seedGeo(db, { source: "fixture" }).
 */

import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { seedGeo } from "../src/seeds/geo.seeds.js";

config({ path: ".env" });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const source = process.argv.includes("--fixture") ? "fixture" : "world";

const sql = postgres(databaseUrl, { max: 1 });
const db = drizzle(sql);

try {
  console.log(
    source === "fixture"
      ? "Seeding geo fixture…"
      : `Seeding world geo (CSC ${"v3.2-export.7"} nested dump; downloads ~3.5MB gz on first run)…`
  );
  const counts = await seedGeo(db, {
    source,
    onPhase: (phase, count) => {
      console.log(`  ${phase}: ${count}`);
    },
  });
  console.log(
    `Done. countries=${counts.countries} states=${counts.states} cities=${counts.cities}`
  );
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
