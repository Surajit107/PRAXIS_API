import request from "supertest";
import { app } from "@/app.js";
import { ensureTestDb } from "./db.js";

/**
 * Boot DB, then return a supertest agent bound to the Express app (no listen).
 */
export async function getTestAgent() {
  await ensureTestDb();
  return request(app);
}
