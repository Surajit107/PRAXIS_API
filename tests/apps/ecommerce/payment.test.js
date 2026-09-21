import crypto from "crypto";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";
import { eq } from "drizzle-orm";
import { PaymentProviderEnum } from "@/constants.js";
import { dbInstance } from "@/db/index.js";
import { cartItems, carts } from "@/models/apps/ecommerce/cart.models.js";
import { ecomOrders } from "@/models/apps/ecommerce/order.models.js";
import { products } from "@/models/apps/ecommerce/product.models.js";
import {
  __resetPaymentProviderMocksForTests,
  __setPaymentProviderMocksForTests,
} from "@/utils/paymentProviders.js";
import { getTestAgent } from "../../helpers/app.js";
import { clearDb, ensureTestDb } from "../../helpers/db.js";
import {
  TINY_PNG,
  promoteToAdmin,
  registerAndLogin,
} from "../../helpers/ecommerce.js";

describe("Ecommerce — payments (P7)", () => {
  /** @type {import("supertest").SuperTest<import("supertest").Test>} */
  let agent;
  /** @type {Record<string, string>} */
  let auth;
  /** @type {string} */
  let productId;
  /** @type {string} */
  let addressId;
  /** @type {string} */
  let couponCode;

  const initialStock = 20;
  const razorpaySecret = "test_razorpay_secret_for_hmac";

  /** @type {ReturnType<typeof jest.fn>} */
  let stripeCreate;
  /** @type {ReturnType<typeof jest.fn>} */
  let stripeRetrieve;
  /** @type {ReturnType<typeof jest.fn>} */
  let razorpayCreate;

  beforeAll(async () => {
    process.env.RAZORPAY_KEY_SECRET = razorpaySecret;
    process.env.RAZORPAY_KEY_ID = "rzp_test_mock";
    process.env.STRIPE_SECRET_KEY = "sk_test_mock";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_mock";
    process.env.STRIPE_PUBLISHABLE_KEY =
      "pk_test_51PcBC7KIkVXvxevzxo9JLi0GjXO7yuXn0iF2hflRzbDrzcgOdNGAA2KwD9uayN468X5xlgdFiO70gxCpgqXO8r6u00I72d6qR8";
    process.env.PAYPAL_CLIENT_ID = "paypal_client_mock";
    process.env.PAYPAL_SECRET = "paypal_secret_mock";

    stripeCreate = jest.fn();
    stripeRetrieve = jest.fn();
    razorpayCreate = jest.fn();

    __setPaymentProviderMocksForTests({
      stripe: {
        paymentIntents: {
          create: stripeCreate,
          retrieve: stripeRetrieve,
        },
      },
      razorpay: {
        orders: {
          create: razorpayCreate,
        },
      },
      paypalApi: async (endpoint) => ({
        ok: true,
        json: async () =>
          endpoint === "/"
            ? { id: "PAYPAL-TEST-ORDER-1", status: "CREATED" }
            : { id: "PAYPAL-TEST-ORDER-1", status: "COMPLETED" },
      }),
      stripeConstructEvent: (_raw, _sig) => ({
        id: "evt_test_default",
        type: "payment_intent.succeeded",
        data: { object: { id: "pi_webhook_unused" } },
      }),
    });

    agent = await getTestAgent();
    await clearDb();
    await ensureTestDb();

    const session = await registerAndLogin(agent);
    await promoteToAdmin(session.user._id);
    auth = session.auth;

    const catRes = await agent
      .post("/api/v1/ecommerce/categories")
      .set(auth)
      .send({ name: "pay-cat" });

    const productRes = await agent
      .post("/api/v1/ecommerce/products")
      .set(auth)
      .field("name", "Payment Product")
      .field("description", "For payment tests")
      .field("category", catRes.body.data._id)
      .field("price", "500")
      .field("stock", String(initialStock))
      .attach("mainImage", TINY_PNG, "main.png");

    productId = productRes.body.data._id;

    const addressRes = await agent
      .post("/api/v1/ecommerce/addresses")
      .set(auth)
      .send({
        addressLine1: "9 Payment Ave",
        addressLine2: null,
        city: "Bengaluru",
        country: "India",
        pincode: "560001",
        state: "KA",
      });
    addressId = addressRes.body.data._id;

    couponCode = `PAY${Date.now().toString().slice(-6)}`;
    const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const expiryDate = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    ).toISOString();

    await agent
      .post("/api/v1/ecommerce/coupons")
      .set(auth)
      .send({
        name: "Pay Save 50",
        couponCode,
        discountValue: 50,
        minimumCartValue: 100,
        startDate,
        expiryDate,
      });
  });

  beforeEach(async () => {
    stripeCreate.mockReset();
    stripeRetrieve.mockReset();
    razorpayCreate.mockReset();

    await dbInstance
      .update(products)
      .set({ stock: initialStock })
      .where(eq(products.id, productId));

    await dbInstance.delete(cartItems);
    await dbInstance.update(carts).set({ coupon: null });

    await agent
      .post(`/api/v1/ecommerce/cart/item/${productId}`)
      .set(auth)
      .send({ quantity: 2 });

    await agent
      .post("/api/v1/ecommerce/coupons/c/apply")
      .set(auth)
      .send({ couponCode });
  });

  afterAll(async () => {
    __resetPaymentProviderMocksForTests();
    await clearDb();
  });

  /**
   * @param {string} paymentId
   */
  async function assertFulfillmentSideEffects(paymentId) {
    const [order] = await dbInstance
      .select()
      .from(ecomOrders)
      .where(eq(ecomOrders.paymentId, paymentId))
      .limit(1);

    expect(order).toBeDefined();
    expect(order.isPaymentDone).toBe(true);
    expect(order.coupon).toBeTruthy();

    const [product] = await dbInstance
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
    expect(product.stock).toBe(initialStock - 2);

    const cartRes = await agent.get("/api/v1/ecommerce/cart").set(auth);
    expect(cartRes.status).toBe(200);
    expect(cartRes.body.data.items).toHaveLength(0);

    const [cartRow] = await dbInstance.select().from(carts).limit(1);
    expect(cartRow.coupon).toBeNull();
  }

  test("Stripe: create order + verify payment (mocked) with stock/coupon/cart side-effects", async () => {
    stripeCreate.mockResolvedValue({
      id: "pi_test_stripe_1",
      client_secret: "pi_test_stripe_1_secret",
      amount: 95000,
      currency: "inr",
      status: "requires_payment_method",
    });
    stripeRetrieve.mockResolvedValue({
      id: "pi_test_stripe_1",
      status: "succeeded",
    });

    const createRes = await agent
      .post("/api/v1/ecommerce/orders/provider/stripe")
      .set(auth)
      .send({ addressId });

    expect(createRes.status).toBe(200);
    expect(createRes.body.data).toMatchObject({
      id: "pi_test_stripe_1",
      client_secret: "pi_test_stripe_1_secret",
    });
    expect(stripeCreate).toHaveBeenCalledTimes(1);

    const [unpaid] = await dbInstance
      .select()
      .from(ecomOrders)
      .where(eq(ecomOrders.paymentId, "pi_test_stripe_1"))
      .limit(1);
    expect(unpaid.paymentProvider).toBe(PaymentProviderEnum.STRIPE);
    expect(unpaid.isPaymentDone).toBe(false);
    expect(unpaid.discountedOrderPrice).toBe(950);

    const verifyRes = await agent
      .post("/api/v1/ecommerce/orders/provider/stripe/verify-payment")
      .set(auth)
      .send({ stripe_payment_intent_id: "pi_test_stripe_1" });

    expect(verifyRes.status).toBe(201);
    expect(verifyRes.body.data.isPaymentDone).toBe(true);
    await assertFulfillmentSideEffects("pi_test_stripe_1");
  });

  test("Razorpay: create order + verify payment (mocked) with stock/coupon/cart side-effects", async () => {
    razorpayCreate.mockResolvedValue({
      id: "order_test_rzp_1",
      amount: 95000,
      currency: "INR",
      status: "created",
    });

    const createRes = await agent
      .post("/api/v1/ecommerce/orders/provider/razorpay")
      .set(auth)
      .send({ addressId });

    expect(createRes.status).toBe(200);
    expect(createRes.body.data.id).toBe("order_test_rzp_1");
    expect(razorpayCreate).toHaveBeenCalledTimes(1);

    const paymentId = "pay_test_rzp_1";
    const signature = crypto
      .createHmac("sha256", razorpaySecret)
      .update(`order_test_rzp_1|${paymentId}`)
      .digest("hex");

    const verifyRes = await agent
      .post("/api/v1/ecommerce/orders/provider/razorpay/verify-payment")
      .set(auth)
      .send({
        razorpay_order_id: "order_test_rzp_1",
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
      });

    expect(verifyRes.status).toBe(201);
    await assertFulfillmentSideEffects("order_test_rzp_1");
  });

  test("PayPal: create order + verify payment (mocked) with stock/coupon/cart side-effects", async () => {
    const createRes = await agent
      .post("/api/v1/ecommerce/orders/provider/paypal")
      .set(auth)
      .send({ addressId });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.id).toBe("PAYPAL-TEST-ORDER-1");

    const [unpaid] = await dbInstance
      .select()
      .from(ecomOrders)
      .where(eq(ecomOrders.paymentId, "PAYPAL-TEST-ORDER-1"))
      .limit(1);
    expect(unpaid.paymentProvider).toBe(PaymentProviderEnum.PAYPAL);
    expect(unpaid.isPaymentDone).toBe(false);

    const verifyRes = await agent
      .post("/api/v1/ecommerce/orders/provider/paypal/verify-payment")
      .set(auth)
      .send({ orderId: "PAYPAL-TEST-ORDER-1" });

    expect(verifyRes.status).toBe(200);
    await assertFulfillmentSideEffects("PAYPAL-TEST-ORDER-1");
  });

  test("Stripe verify rejects non-succeeded payment intent", async () => {
    stripeCreate.mockResolvedValue({
      id: "pi_test_stripe_fail",
      client_secret: "sec",
      amount: 95000,
      currency: "inr",
      status: "requires_payment_method",
    });
    stripeRetrieve.mockResolvedValue({
      id: "pi_test_stripe_fail",
      status: "requires_payment_method",
    });

    await agent
      .post("/api/v1/ecommerce/orders/provider/stripe")
      .set(auth)
      .send({ addressId });

    const verifyRes = await agent
      .post("/api/v1/ecommerce/orders/provider/stripe/verify-payment")
      .set(auth)
      .send({ stripe_payment_intent_id: "pi_test_stripe_fail" });

    expect(verifyRes.status).toBe(400);
  });

  test("Stripe webhook payment_intent.succeeded fulfills order (/stripe/webhook)", async () => {
    stripeCreate.mockResolvedValue({
      id: "pi_test_webhook_1",
      client_secret: "pi_test_webhook_1_secret",
      amount: 95000,
      currency: "inr",
      status: "requires_payment_method",
    });

    const createRes = await agent
      .post("/api/v1/ecommerce/orders/provider/stripe")
      .set(auth)
      .send({ addressId });

    expect(createRes.status).toBe(200);
    expect(createRes.body.data.publishableKey).toBe(
      process.env.STRIPE_PUBLISHABLE_KEY
    );

    __setPaymentProviderMocksForTests({
      stripeConstructEvent: () => ({
        id: "evt_test_webhook_1",
        type: "payment_intent.succeeded",
        data: { object: { id: "pi_test_webhook_1" } },
      }),
    });

    const webhookRes = await agent
      .post("/stripe/webhook")
      .set("stripe-signature", "t=1,v1=test")
      .set("Content-Type", "application/json")
      .send(
        Buffer.from(
          JSON.stringify({
            id: "evt_test_webhook_1",
            type: "payment_intent.succeeded",
          })
        )
      );

    expect(webhookRes.status).toBe(200);
    expect(webhookRes.body).toEqual({ received: true });
    await assertFulfillmentSideEffects("pi_test_webhook_1");
  });
});
