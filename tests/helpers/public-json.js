import { dbInstance } from "@/db/index.js";
import { seedPublicJson } from "@/seeds/public-json.seeds.js";
import { ensureTestDb } from "./db.js";

/**
 * Seed public_json_docs on the test DB (same data as `npm run db:seed:public`).
 * Call after clearDb() so lists are non-empty for public API happy-paths.
 */
export async function seedPublicJsonForTests() {
  await ensureTestDb();
  return seedPublicJson(dbInstance);
}
