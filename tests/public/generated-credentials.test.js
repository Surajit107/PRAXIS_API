import fs from "fs";
import path from "path";
import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import { getTestAgent } from "../helpers/app.js";
import { clearDb } from "../helpers/db.js";

/**
 * Confirms GET /api/v1/seed/generated-credentials still reads
 * ./public/temp/seed-credentials.json (unchanged by public_json seed rewrite).
 */
describe("Seed generated-credentials", () => {
  /** @type {import("supertest").SuperTest<import("supertest").Test>} */
  let agent;
  const credentialsPath = path.resolve("./public/temp/seed-credentials.json");
  /** @type {string | null} */
  let previousContents = null;

  beforeAll(async () => {
    agent = await getTestAgent();
    await clearDb();

    if (fs.existsSync(credentialsPath)) {
      previousContents = fs.readFileSync(credentialsPath, "utf8");
    }

    fs.mkdirSync(path.dirname(credentialsPath), { recursive: true });
    fs.writeFileSync(
      credentialsPath,
      JSON.stringify([
        { username: "credcheck", password: "CredPass123!", role: "USER" },
      ]),
      "utf8"
    );
  });

  afterAll(async () => {
    if (previousContents === null) {
      if (fs.existsSync(credentialsPath)) {
        fs.unlinkSync(credentialsPath);
      }
    } else {
      fs.writeFileSync(credentialsPath, previousContents, "utf8");
    }
    await clearDb();
  });

  test("GET /api/v1/seed/generated-credentials reads ./public/temp/seed-credentials.json", async () => {
    const res = await agent.get("/api/v1/seed/generated-credentials");

    expect(res.status).toBe(200);
    expect(res.body.statusCode).toBe(200);
    expect(res.body.data).toEqual([
      expect.objectContaining({
        username: "credcheck",
        password: "CredPass123!",
        role: "USER",
      }),
    ]);
  });
});
