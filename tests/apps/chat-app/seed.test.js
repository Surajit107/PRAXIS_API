import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import { count } from "drizzle-orm";
import { dbInstance } from "@/db/index.js";
import { chats } from "@/models/apps/chat-app/chat.models.js";
import { getTestAgent } from "../../helpers/app.js";
import { clearDb } from "../../helpers/db.js";

describe("Chat app — seed smoke", () => {
  /** @type {import("supertest").SuperTest<import("supertest").Test>} */
  let agent;

  beforeAll(async () => {
    agent = await getTestAgent();
    await clearDb();
  }, 60_000);

  afterAll(async () => {
    await clearDb();
  });

  test("POST /api/v1/seed/chat-app populates domain", async () => {
    const res = await agent.post("/api/v1/seed/chat-app");

    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/chat app/i);

    const [row] = await dbInstance
      .select({ value: count() })
      .from(chats);
    expect(Number(row?.value ?? 0)).toBeGreaterThan(0);
  }, 300_000);
});
