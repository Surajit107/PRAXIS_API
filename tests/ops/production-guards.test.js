import { afterEach, beforeAll, describe, expect, test } from "@jest/globals";
import { getTestAgent } from "../helpers/app.js";

/**
 * P6 gate: seed/* and reset-db must be blocked outside development.
 * `avoidInProduction` allows only NODE_ENV === "development".
 */
describe("Ops — production guards (seed + reset-db)", () => {
  /** @type {import("supertest").SuperTest<import("supertest").Test>} */
  let agent;
  /** @type {string | undefined} */
  let previousNodeEnv;

  beforeAll(async () => {
    agent = await getTestAgent();
    previousNodeEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env.NODE_ENV = previousNodeEnv;
  });

  test("POST /api/v1/seed/todos returns 403 when NODE_ENV=production", async () => {
    process.env.NODE_ENV = "production";
    const res = await agent.post("/api/v1/seed/todos");

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(String(res.body.message)).toMatch(/local environment/i);
  });

  test("GET /api/v1/seed/generated-credentials returns 403 when NODE_ENV=production", async () => {
    process.env.NODE_ENV = "production";
    const res = await agent.get("/api/v1/seed/generated-credentials");

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test("DELETE /api/v1/reset-db returns 403 when NODE_ENV=production", async () => {
    process.env.NODE_ENV = "production";
    const res = await agent.delete("/api/v1/reset-db");

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test("seed route still works when NODE_ENV=development", async () => {
    process.env.NODE_ENV = "development";
    const res = await agent.post("/api/v1/seed/todos");

    // Handler runs (201) — not blocked by avoidInProduction
    expect(res.status).toBe(201);
    expect(res.body.statusCode).toBe(201);
  });
});
