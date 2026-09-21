import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import { getTestAgent } from "../helpers/app.js";
import { clearDb } from "../helpers/db.js";
import { seedGeoForTests } from "../helpers/geo.js";

describe("Public Geo APIs", () => {
  /** @type {import("supertest").SuperTest<import("supertest").Test>} */
  let agent;

  beforeAll(async () => {
    agent = await getTestAgent();
    await clearDb();
    await seedGeoForTests();
  }, 60_000);

  afterAll(async () => {
    await clearDb();
  });

  test("GET /api/v1/public/geo/countries", async () => {
    const res = await agent
      .get("/api/v1/public/geo/countries")
      .query({ page: 1, limit: 10 });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        page: 1,
        limit: 10,
        totalItems: 2,
        data: expect.any(Array),
      })
    );
    expect(res.body.data.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ iso2: "IN", name: "India" }),
        expect.objectContaining({ iso2: "US", name: "United States" }),
      ])
    );
  });

  test("GET /api/v1/public/geo/countries?q=ind", async () => {
    const res = await agent
      .get("/api/v1/public/geo/countries")
      .query({ q: "ind" });

    expect(res.status).toBe(200);
    expect(res.body.data.totalItems).toBe(1);
    expect(res.body.data.data[0].iso2).toBe("IN");
  });

  test("GET /api/v1/public/geo/states requires countryCode", async () => {
    const res = await agent.get("/api/v1/public/geo/states");
    expect(res.status).toBe(400);
  });

  test("GET /api/v1/public/geo/states?countryCode=IN", async () => {
    const res = await agent
      .get("/api/v1/public/geo/states")
      .query({ countryCode: "IN", page: 1, limit: 10 });

    expect(res.status).toBe(200);
    expect(res.body.data.totalItems).toBe(2);
    expect(res.body.data.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Maharashtra",
          countryCode: "IN",
          id: 4008,
        }),
        expect.objectContaining({
          name: "Karnataka",
          countryCode: "IN",
        }),
      ])
    );
  });

  test("GET /api/v1/public/geo/cities requires stateId", async () => {
    const res = await agent.get("/api/v1/public/geo/cities");
    expect(res.status).toBe(400);
  });

  test("GET /api/v1/public/geo/cities?stateId=4008", async () => {
    const res = await agent
      .get("/api/v1/public/geo/cities")
      .query({ stateId: 4008, page: 1, limit: 10 });

    expect(res.status).toBe(200);
    expect(res.body.data.totalItems).toBe(2);
    expect(res.body.data.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Mumbai", stateId: 4008 }),
        expect.objectContaining({ name: "Pune", stateId: 4008 }),
      ])
    );
  });

  test("GET /api/v1/public/geo/cities?stateId=4008&q=mum", async () => {
    const res = await agent
      .get("/api/v1/public/geo/cities")
      .query({ stateId: 4008, q: "mum" });

    expect(res.status).toBe(200);
    expect(res.body.data.totalItems).toBe(1);
    expect(res.body.data.data[0].name).toBe("Mumbai");
  });
});
