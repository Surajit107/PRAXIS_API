import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import { getTestAgent } from "../../helpers/app.js";
import { clearDb } from "../../helpers/db.js";
import {
  promoteToAdmin,
  registerAndLogin,
} from "../../helpers/ecommerce.js";

describe("Ecommerce — categories", () => {
  /** @type {import("supertest").SuperTest<import("supertest").Test>} */
  let agent;
  /** @type {Record<string, string>} */
  let auth;
  /** @type {string} */
  let categoryId;

  beforeAll(async () => {
    agent = await getTestAgent();
    await clearDb();
    const session = await registerAndLogin(agent);
    await promoteToAdmin(session.user._id);
    auth = session.auth;
  });

  afterAll(async () => {
    await clearDb();
  });

  test("POST /api/v1/ecommerce/categories creates category", async () => {
    const res = await agent
      .post("/api/v1/ecommerce/categories")
      .set(auth)
      .send({ name: "electronics" });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ name: "electronics" });
    expect(res.body.data._id).toBeDefined();
    categoryId = res.body.data._id;
  });

  test("GET /api/v1/ecommerce/categories returns paginated shape", async () => {
    const res = await agent.get("/api/v1/ecommerce/categories?page=1&limit=10");

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      totalCategories: 1,
      categories: expect.any(Array),
      page: 1,
      limit: 10,
      hasNextPage: false,
      hasPrevPage: false,
    });
    expect(res.body.data.categories[0]._id).toBe(categoryId);
  });

  test("GET /api/v1/ecommerce/categories/:id fetches category", async () => {
    const res = await agent.get(`/api/v1/ecommerce/categories/${categoryId}`);
    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe(categoryId);
  });

  test("PATCH /api/v1/ecommerce/categories/:id updates name", async () => {
    const res = await agent
      .patch(`/api/v1/ecommerce/categories/${categoryId}`)
      .set(auth)
      .send({ name: "gadgets" });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("gadgets");
  });

  test("DELETE /api/v1/ecommerce/categories/:id deletes category", async () => {
    const res = await agent
      .delete(`/api/v1/ecommerce/categories/${categoryId}`)
      .set(auth);

    expect(res.status).toBe(200);
    expect(res.body.data.deletedCategory._id).toBe(categoryId);
  });
});
