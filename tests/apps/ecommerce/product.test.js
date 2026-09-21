import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import { getTestAgent } from "../../helpers/app.js";
import { clearDb } from "../../helpers/db.js";
import {
  TINY_PNG,
  promoteToAdmin,
  registerAndLogin,
} from "../../helpers/ecommerce.js";

describe("Ecommerce — products", () => {
  /** @type {import("supertest").SuperTest<import("supertest").Test>} */
  let agent;
  /** @type {Record<string, string>} */
  let auth;
  /** @type {string} */
  let categoryId;
  /** @type {string} */
  let productId;
  /** @type {string} */
  let subImageId;

  beforeAll(async () => {
    agent = await getTestAgent();
    await clearDb();
    const session = await registerAndLogin(agent);
    await promoteToAdmin(session.user._id);
    auth = session.auth;

    const catRes = await agent
      .post("/api/v1/ecommerce/categories")
      .set(auth)
      .send({ name: "product-cat" });
    categoryId = catRes.body.data._id;
  });

  afterAll(async () => {
    await clearDb();
  });

  test("POST /api/v1/ecommerce/products creates product with mainImage + subImages", async () => {
    const res = await agent
      .post("/api/v1/ecommerce/products")
      .set(auth)
      .field("name", "Test Product")
      .field("description", "A test product description")
      .field("category", categoryId)
      .field("price", "499")
      .field("stock", "20")
      .attach("mainImage", TINY_PNG, "main.png")
      .attach("subImages", TINY_PNG, "sub1.png");

    expect(res.status).toBe(201);
    expect(res.body.data._id).toBeDefined();
    expect(res.body.data.mainImage).toEqual(
      expect.objectContaining({
        url: expect.any(String),
        localPath: expect.any(String),
      })
    );
    expect(res.body.data.subImages).toHaveLength(1);
    expect(res.body.data.subImages[0]._id).toBeDefined();
    productId = res.body.data._id;
    subImageId = res.body.data.subImages[0]._id;
  });

  test("GET /api/v1/ecommerce/products returns paginated hydrated products", async () => {
    const res = await agent.get("/api/v1/ecommerce/products?page=1&limit=10");

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      totalProducts: 1,
      products: expect.any(Array),
    });
    expect(res.body.data.products[0].mainImage.url).toBeDefined();
    expect(res.body.data.products[0].subImages).toEqual(expect.any(Array));
  });

  test("GET /api/v1/ecommerce/products/:id hydrates nested images", async () => {
    const res = await agent.get(`/api/v1/ecommerce/products/${productId}`);

    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe(productId);
    expect(res.body.data.mainImage.url).toBeDefined();
    expect(res.body.data.subImages[0]._id).toBe(subImageId);
  });

  test("GET /api/v1/ecommerce/products/category/:id includes category + products", async () => {
    const res = await agent.get(
      `/api/v1/ecommerce/products/category/${categoryId}`
    );

    expect(res.status).toBe(200);
    expect(res.body.data.category._id).toBe(categoryId);
    expect(res.body.data.totalProducts).toBe(1);
    expect(res.body.data.products[0]._id).toBe(productId);
  });

  test("PATCH remove subimage deletes nested row", async () => {
    const res = await agent
      .patch(
        `/api/v1/ecommerce/products/remove/subimage/${productId}/${subImageId}`
      )
      .set(auth);

    expect(res.status).toBe(200);
    expect(res.body.data.subImages).toHaveLength(0);
  });

  test("DELETE /api/v1/ecommerce/products/:id deletes product", async () => {
    const res = await agent
      .delete(`/api/v1/ecommerce/products/${productId}`)
      .set(auth);

    expect(res.status).toBe(200);
    expect(res.body.data.deletedProduct._id).toBe(productId);
  });
});
