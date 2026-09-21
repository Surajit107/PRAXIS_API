import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import { getTestAgent } from "../../helpers/app.js";
import { clearDb } from "../../helpers/db.js";
import {
  TINY_PNG,
  promoteToAdmin,
  registerAndLogin,
} from "../../helpers/ecommerce.js";

describe("Ecommerce — coupons", () => {
  /** @type {import("supertest").SuperTest<import("supertest").Test>} */
  let agent;
  /** @type {Record<string, string>} */
  let auth;
  /** @type {string} */
  let couponId;
  /** @type {string} */
  let productId;
  const couponCode = "SAVE100";

  beforeAll(async () => {
    agent = await getTestAgent();
    await clearDb();
    const session = await registerAndLogin(agent);
    await promoteToAdmin(session.user._id);
    auth = session.auth;

    const catRes = await agent
      .post("/api/v1/ecommerce/categories")
      .set(auth)
      .send({ name: "coupon-cat" });

    const productRes = await agent
      .post("/api/v1/ecommerce/products")
      .set(auth)
      .field("name", "Coupon Product")
      .field("description", "For coupon tests")
      .field("category", catRes.body.data._id)
      .field("price", "500")
      .field("stock", "50")
      .attach("mainImage", TINY_PNG, "main.png");

    productId = productRes.body.data._id;
  });

  afterAll(async () => {
    await clearDb();
  });

  test("POST /api/v1/ecommerce/coupons creates coupon", async () => {
    const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const expiryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const res = await agent
      .post("/api/v1/ecommerce/coupons")
      .set(auth)
      .send({
        name: "Flat 100",
        couponCode,
        discountValue: 100,
        minimumCartValue: 200,
        startDate,
        expiryDate,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.couponCode).toBe(couponCode);
    expect(res.body.data._id).toBeDefined();
    couponId = res.body.data._id;
  });

  test("GET /api/v1/ecommerce/coupons returns paginated shape", async () => {
    const res = await agent
      .get("/api/v1/ecommerce/coupons?page=1&limit=10")
      .set(auth);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      totalCoupons: 1,
      coupons: expect.any(Array),
    });
  });

  test("POST /c/apply applies coupon to cart", async () => {
    await agent
      .post(`/api/v1/ecommerce/cart/item/${productId}`)
      .set(auth)
      .send({ quantity: 1 });

    const res = await agent
      .post("/api/v1/ecommerce/coupons/c/apply")
      .set(auth)
      .send({ couponCode });

    expect(res.status).toBe(200);
    expect(res.body.data.cartTotal).toBe(500);
    expect(res.body.data.discountedTotal).toBe(400);
    expect(res.body.data.coupon._id).toBe(couponId);
  });

  test("GET /customer/available lists valid coupons", async () => {
    const res = await agent
      .get("/api/v1/ecommerce/coupons/customer/available")
      .set(auth);

    expect(res.status).toBe(200);
    expect(res.body.data.totalCoupons).toBeGreaterThanOrEqual(1);
    expect(res.body.data.coupons[0].couponCode).toBe(couponCode);
  });

  test("POST /c/remove removes coupon from cart", async () => {
    const res = await agent
      .post("/api/v1/ecommerce/coupons/c/remove")
      .set(auth);

    expect(res.status).toBe(200);
    expect(res.body.data.coupon).toBeNull();
    expect(res.body.data.discountedTotal).toBe(500);
  });

  test("PATCH /status/:id toggles isActive", async () => {
    const res = await agent
      .patch(`/api/v1/ecommerce/coupons/status/${couponId}`)
      .set(auth)
      .send({ isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);
  });

  test("DELETE /api/v1/ecommerce/coupons/:id deletes coupon", async () => {
    const res = await agent
      .delete(`/api/v1/ecommerce/coupons/${couponId}`)
      .set(auth);

    expect(res.status).toBe(200);
    expect(res.body.data.deletedCoupon._id).toBe(couponId);
  });
});
