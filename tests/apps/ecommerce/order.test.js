import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import {
  OrderStatusEnum,
  PaymentProviderEnum,
} from "@/constants.js";
import { dbInstance } from "@/db/index.js";
import {
  ecomOrderItems,
  ecomOrders,
} from "@/models/apps/ecommerce/order.models.js";
import { getTestAgent } from "../../helpers/app.js";
import { clearDb, ensureTestDb } from "../../helpers/db.js";
import {
  TINY_PNG,
  promoteToAdmin,
  registerAndLogin,
} from "../../helpers/ecommerce.js";

describe("Ecommerce — orders", () => {
  /** @type {import("supertest").SuperTest<import("supertest").Test>} */
  let agent;
  /** @type {Record<string, string>} */
  let auth;
  /** @type {string} */
  let userId;
  /** @type {string} */
  let productId;
  /** @type {string} */
  let orderId;

  beforeAll(async () => {
    agent = await getTestAgent();
    await clearDb();
    await ensureTestDb();

    const session = await registerAndLogin(agent);
    await promoteToAdmin(session.user._id);
    auth = session.auth;
    userId = session.user._id;

    const catRes = await agent
      .post("/api/v1/ecommerce/categories")
      .set(auth)
      .send({ name: "order-cat" });

    const productRes = await agent
      .post("/api/v1/ecommerce/products")
      .set(auth)
      .field("name", "Order Product")
      .field("description", "For order tests")
      .field("category", catRes.body.data._id)
      .field("price", "250")
      .field("stock", "10")
      .attach("mainImage", TINY_PNG, "main.png");

    productId = productRes.body.data._id;

    // Insert order directly (payment providers are P7); assert hydration/status/list here.
    const [order] = await dbInstance
      .insert(ecomOrders)
      .values({
        customer: userId,
        orderPrice: 500,
        discountedOrderPrice: 500,
        addressLine1: "1 Order Lane",
        addressLine2: null,
        city: "Delhi",
        country: "India",
        pincode: "110001",
        state: "DL",
        status: OrderStatusEnum.PENDING,
        paymentProvider: PaymentProviderEnum.RAZORPAY,
        paymentId: "pay_test_order_1",
        isPaymentDone: true,
      })
      .returning();

    await dbInstance.insert(ecomOrderItems).values({
      orderId: order.id,
      productId,
      quantity: 2,
    });

    orderId = order.id;
  });

  afterAll(async () => {
    await clearDb();
  });

  test("GET /api/v1/ecommerce/orders/:id returns {_id, order} with address + items", async () => {
    const res = await agent
      .get(`/api/v1/ecommerce/orders/${orderId}`)
      .set(auth);

    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe(orderId);
    expect(res.body.data.order).toMatchObject({
      _id: orderId,
      address: {
        addressLine1: "1 Order Lane",
        city: "Delhi",
        country: "India",
        pincode: "110001",
        state: "DL",
      },
      customer: expect.objectContaining({
        _id: userId,
        email: expect.any(String),
      }),
      items: [
        expect.objectContaining({
          _id: expect.any(String),
          quantity: 2,
          product: expect.objectContaining({
            _id: productId,
            mainImage: expect.objectContaining({ url: expect.any(String) }),
          }),
        }),
      ],
    });
  });

  test("GET /list/admin returns paginated orders without items array", async () => {
    const res = await agent
      .get("/api/v1/ecommerce/orders/list/admin")
      .set(auth);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      totalOrders: 1,
      orders: expect.any(Array),
    });
    expect(res.body.data.orders[0]._id).toBe(orderId);
    expect(res.body.data.orders[0].totalOrderItems).toBe(1);
    expect(res.body.data.orders[0].items).toBeUndefined();
    expect(res.body.data.orders[0].address).toBeDefined();
  });

  test("PATCH /status/:id updates status", async () => {
    const res = await agent
      .patch(`/api/v1/ecommerce/orders/status/${orderId}`)
      .set(auth)
      .send({ status: OrderStatusEnum.DELIVERED });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ status: OrderStatusEnum.DELIVERED });
  });

  test("PATCH /status/:id rejects already delivered", async () => {
    const res = await agent
      .patch(`/api/v1/ecommerce/orders/status/${orderId}`)
      .set(auth)
      .send({ status: OrderStatusEnum.CANCELLED });

    expect(res.status).toBe(400);
  });
});
