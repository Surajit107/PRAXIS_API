import fs from "fs";
import path from "path";
import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import { getTestAgent } from "../helpers/app.js";
import { clearDb } from "../helpers/db.js";

/**
 * YouTube controllers:
 * - Keep static file JSON imports (not public_json / db:seed:public).
 * - HTTP mount stays disabled (copyrighted third-party channel/video payloads).
 */
describe("Public YouTube (unmounted)", () => {
  /** @type {import("supertest").SuperTest<import("supertest").Test>} */
  let agent;

  beforeAll(async () => {
    agent = await getTestAgent();
  });

  afterAll(async () => {
    await clearDb();
  });

  test("controllers still import file JSON (not public_json)", () => {
    const controllerPath = path.resolve(
      "./src/controllers/public/youtube.controllers.js"
    );
    const source = fs.readFileSync(controllerPath, "utf8");

    expect(source).toMatch(
      /from\s+["']@\/json\/youtube\/channel\.json["']/
    );
    expect(source).toMatch(/with\s*\{\s*type:\s*["']json["']\s*\}/);
    expect(source).not.toMatch(/publicJsonDb/);
    expect(source).not.toMatch(/listPayloads/);
  });

  test("GET /api/v1/public/youtube/* is not mounted (copyright)", async () => {
    const res = await agent.get("/api/v1/public/youtube/channel");

    // Unmounted routes fall through to Swagger UI on `/` (HTML 200), not the
    // YouTube ApiResponse. Assert the public YouTube handler did not run.
    const isYouTubeApiResponse =
      res.body?.statusCode === 200 &&
      res.body?.data?.info?.id === "UCXgGY0wkgOzynnHvSEVmE3A";

    expect(isYouTubeApiResponse).toBe(false);
    expect(String(res.headers["content-type"] || "")).toMatch(/html|text/i);
  });
});
