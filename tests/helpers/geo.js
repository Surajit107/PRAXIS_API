import { seedGeo } from "@/seeds/geo.seeds.js";
import { ensureTestDb } from "./db.js";

/**
 * Tiny geo fixture for tests (not the world CSC dump).
 */
export async function seedGeoForTests() {
  const db = await ensureTestDb();
  return seedGeo(db, { source: "fixture" });
}
