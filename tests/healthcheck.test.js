import { describe, expect, test } from "@jest/globals";
import { getTestAgent } from "./helpers/app.js";

describe("Healthcheck", () => {
  test("GET /api/v1/healthcheck returns ok", async () => {
    const agent = await getTestAgent();
    const res = await agent.get("/api/v1/healthcheck");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
