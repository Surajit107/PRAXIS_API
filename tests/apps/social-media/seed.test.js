import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import { count } from "drizzle-orm";
import { dbInstance } from "@/db/index.js";
import { socialPosts } from "@/models/apps/social-media/post.models.js";
import { getTestAgent } from "../../helpers/app.js";
import { clearDb } from "../../helpers/db.js";

describe("Social media — seed smoke", () => {
  /** @type {import("supertest").SuperTest<import("supertest").Test>} */
  let agent;

  beforeAll(async () => {
    agent = await getTestAgent();
    await clearDb();
  }, 60_000);

  afterAll(async () => {
    await clearDb();
  });

  test("POST /api/v1/seed/social-media populates domain", async () => {
    // Route runs seedUsers then seedSocialMedia (Jest shrinks social volumes).
    const res = await agent.post("/api/v1/seed/social-media");

    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/social media/i);

    const [row] = await dbInstance
      .select({ value: count() })
      .from(socialPosts);
    expect(Number(row?.value ?? 0)).toBeGreaterThan(0);
  }, 300_000);
});
