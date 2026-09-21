import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import { getTestAgent } from "../../helpers/app.js";
import { clearDb } from "../../helpers/db.js";
import {
  TINY_PNG,
  promoteToAdmin,
  registerAndLogin,
} from "../../helpers/ecommerce.js";

describe("Ecommerce — cart", () => {
  /** @type {import("supertest").SuperTest<import("supertest").Test>} */
  let agent;
  /** @type {Record<string, string>} */
  let auth;
  /** @type {string} */
  let productId;

  beforeAll(async () => {
    agent = await getTestAgent();
    await clearDb();
    const session = await registerAndLogin(agent);
    await promoteToAdmin(session.user._id);
    auth = session.auth;

    const catRes = await agent
      .post("/api/v1/ecommerce/categories")
      .set(auth)
      .send({ name: "cart-cat" });

    const productRes = await agent
      .post("/api/v1/ecommerce/products")
      .set(auth)
      .field("name", "Cart Product")
      .field("description", "For cart tests")
      .field("category", catRes.body.data._id)
      .field("price", "100")
      .field("stock", "50")
      .attach("mainImage", TINY_PNG, "main.png");

    productId = productRes.body.data._id;
  });

  afterAll(async () => {
    await clearDb();
  });

  test("GET /api/v1/ecommerce/cart returns empty cart shape", async () => {
    const res = await agent.get("/api/v1/ecommerce/cart").set(auth);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      _id: null,
      items: [],
      cartTotal: 0,
      discountedTotal: 0,
    });
  });

  test("POST /api/v1/ecommerce/cart/item/:productId adds item with nested product", async () => {
    const res = await agent
      .post(`/api/v1/ecommerce/cart/item/${productId}`)
      .set(auth)
      .send({ quantity: 2 });

    expect(res.status).toBe(200);
    expect(res.body.data._id).toBeDefined();
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0]).toMatchObject({
      _id: expect.any(String),
      quantity: 2,
      product: expect.objectContaining({
        _id: productId,
        mainImage: expect.objectContaining({ url: expect.any(String) }),
        subImages: expect.any(Array),
      }),
    });
    expect(res.body.data.cartTotal).toBe(200);
    expect(res.body.data.discountedTotal).toBe(200);
  });

  test("POST updates quantity and recalculates totals", async () => {
    const res = await agent
      .post(`/api/v1/ecommerce/cart/item/${productId}`)
      .set(auth)
      .send({ quantity: 3 });

    expect(res.status).toBe(200);
    expect(res.body.data.items[0].quantity).toBe(3);
    expect(res.body.data.cartTotal).toBe(300);
  });

  test("DELETE /api/v1/ecommerce/cart/item/:productId removes item", async () => {
    const res = await agent
      .delete(`/api/v1/ecommerce/cart/item/${productId}`)
      .set(auth);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(0);
  });

  test("DELETE /api/v1/ecommerce/cart/clear clears cart", async () => {
    await agent
      .post(`/api/v1/ecommerce/cart/item/${productId}`)
      .set(auth)
      .send({ quantity: 1 });

    const res = await agent.delete("/api/v1/ecommerce/cart/clear").set(auth);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(0);
    expect(res.body.data.cartTotal).toBe(0);
  });
});
