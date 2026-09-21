import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import {
  OrderStatusEnum,
  PaymentProviderEnum,
} from "@/constants.js";
import { dbInstance } from "@/db/index.js";
import { ecomOrders } from "@/models/apps/ecommerce/order.models.js";
import { getTestAgent } from "../../helpers/app.js";
import { clearDb, ensureTestDb } from "../../helpers/db.js";
import { registerAndLogin } from "../../helpers/ecommerce.js";

describe("Ecommerce — profile", () => {
  /** @type {import("supertest").SuperTest<import("supertest").Test>} */
  let agent;
  /** @type {Record<string, string>} */
  let auth;
  /** @type {string} */
  let userId;

  beforeAll(async () => {
    agent = await getTestAgent();
    await clearDb();
    await ensureTestDb();
    const session = await registerAndLogin(agent);
    auth = session.auth;
    userId = session.user._id;

    await dbInstance.insert(ecomOrders).values({
      customer: userId,
      orderPrice: 100,
      discountedOrderPrice: 100,
      addressLine1: "Profile Street",
      city: "Goa",
      country: "India",
      pincode: "403001",
      state: "GA",
      status: OrderStatusEnum.PENDING,
      paymentProvider: PaymentProviderEnum.PAYPAL,
      paymentId: "pay_profile_1",
      isPaymentDone: true,
    });
  });

  afterAll(async () => {
    await clearDb();
  });

  test("GET /api/v1/ecommerce/profile returns ecom profile", async () => {
    const res = await agent.get("/api/v1/ecommerce/profile").set(auth);

    expect(res.status).toBe(200);
    expect(res.body.data._id).toBeDefined();
    expect(res.body.data.owner).toBe(userId);
  });

  test("PATCH /api/v1/ecommerce/profile updates fields", async () => {
    const res = await agent
      .patch("/api/v1/ecommerce/profile")
      .set(auth)
      .send({
        firstName: "Ada",
        lastName: "Lovelace",
        phoneNumber: "9876543210",
        countryCode: "91",
      });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      firstName: "Ada",
      lastName: "Lovelace",
      phoneNumber: "9876543210",
      countryCode: "91",
    });
  });

  test("GET /my-orders returns paginated orders with address snapshot", async () => {
    const res = await agent
      .get("/api/v1/ecommerce/profile/my-orders")
      .set(auth);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      totalOrders: 1,
      orders: expect.any(Array),
    });
    expect(res.body.data.orders[0]).toMatchObject({
      address: expect.objectContaining({
        addressLine1: "Profile Street",
        city: "Goa",
      }),
      totalOrderItems: 0,
    });
    expect(res.body.data.orders[0].items).toBeUndefined();
  });
});
