import { and, count, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  AvailableOrderStatuses,
  OrderStatusEnum,
  PaymentProviderEnum,
} from "@/constants.js";
import { getCart } from "@/controllers/apps/ecommerce/cart.controllers.js";
import { loadSubImagesByProductIds } from "@/controllers/apps/ecommerce/product.controllers.js";
import { dbInstance } from "@/db/index.js";
import { users } from "@/models/apps/auth/user.models.js";
import { addresses } from "@/models/apps/ecommerce/address.models.js";
import {
  cartItems,
  carts,
} from "@/models/apps/ecommerce/cart.models.js";
import { coupons } from "@/models/apps/ecommerce/coupon.models.js";
import {
  ecomOrderItems,
  ecomOrders,
} from "@/models/apps/ecommerce/order.models.js";
import { products } from "@/models/apps/ecommerce/product.models.js";
import {
  shapeOrderAddress,
  shapeProduct,
  withId,
} from "@/models/serializers.js";
import { ApiError } from "@/utils/ApiError.js";
import { ApiResponse } from "@/utils/ApiResponse.js";
import { asyncHandler } from "@/utils/asyncHandler.js";
import {
  orderConfirmationMailgenContent,
  sendEmail,
} from "@/utils/mail.js";
import { aggregatePaginate } from "@/utils/helpers.js";
import {
  getRazorpayClient,
  getStripeClient,
  getStripeCurrency,
  constructStripeWebhookEvent,
  paypalApi,
  verifyRazorpaySignature,
} from "@/utils/paymentProviders.js";
import logger from "@/logger/winston.logger.js";

const requireDb = () => {
  if (!dbInstance) {
    throw new ApiError(500, "Database is not connected");
  }
  return dbInstance;
};

/**
 * Shape order list/detail rows with customer + coupon + address snapshot.
 * @param {import("drizzle-orm/postgres-js").PostgresJsDatabase} db
 * @param {typeof ecomOrders.$inferSelect} order
 * @param {{ includeItems?: boolean }} [opts]
 */
export const hydrateOrder = async (db, order, { includeItems = false } = {}) => {
  const [customerRow] = order.customer
    ? await db
        .select({
          id: users.id,
          username: users.username,
          email: users.email,
        })
        .from(users)
        .where(eq(users.id, order.customer))
        .limit(1)
    : [null];

  const [couponRow] = order.coupon
    ? await db
        .select({
          id: coupons.id,
          name: coupons.name,
          couponCode: coupons.couponCode,
        })
        .from(coupons)
        .where(eq(coupons.id, order.coupon))
        .limit(1)
    : [null];

  const [itemCountRow] = await db
    .select({ value: count() })
    .from(ecomOrderItems)
    .where(eq(ecomOrderItems.orderId, order.id));

  const shaped = shapeOrderAddress(withId(order));
  shaped.customer = customerRow
    ? { _id: customerRow.id, username: customerRow.username, email: customerRow.email }
    : null;
  shaped.coupon = couponRow
    ? {
        _id: couponRow.id,
        name: couponRow.name,
        couponCode: couponRow.couponCode,
      }
    : null;
  shaped.totalOrderItems = Number(itemCountRow?.value ?? 0);

  if (!includeItems) {
    return shaped;
  }

  const itemRows = await db
    .select({
      id: ecomOrderItems.id,
      quantity: ecomOrderItems.quantity,
      product: products,
    })
    .from(ecomOrderItems)
    .innerJoin(products, eq(ecomOrderItems.productId, products.id))
    .where(eq(ecomOrderItems.orderId, order.id));

  const subMap = await loadSubImagesByProductIds(
    db,
    itemRows.map((row) => row.product.id)
  );

  shaped.items = itemRows.map((row) => ({
    _id: row.id,
    quantity: row.quantity,
    product: shapeProduct(row.product, subMap.get(row.product.id) ?? []),
  }));

  return shaped;
};

/**
 * Persist unpaid order + order items from cart rows.
 * @param {import("drizzle-orm/postgres-js").PostgresJsDatabase} db
 * @param {{
 *   address: typeof addresses.$inferSelect;
 *   customerId: string;
 *   cartId: string;
 *   orderPrice: number;
 *   discountedOrderPrice: number;
 *   paymentProvider: string;
 *   paymentId: string;
 *   couponId: string | null | undefined;
 * }} payload
 */
const createUnpaidOrderFromCart = async (db, payload) => {
  const {
    address,
    customerId,
    cartId,
    orderPrice,
    discountedOrderPrice,
    paymentProvider,
    paymentId,
    couponId,
  } = payload;

  const cartItemRows = await db
    .select()
    .from(cartItems)
    .where(eq(cartItems.cartId, cartId));

  return db.transaction(async (tx) => {
    const [order] = await tx
      .insert(ecomOrders)
      .values({
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2,
        city: address.city,
        country: address.country,
        pincode: address.pincode,
        state: address.state,
        customer: customerId,
        orderPrice,
        discountedOrderPrice,
        paymentProvider,
        paymentId,
        coupon: couponId ?? null,
      })
      .returning();

    if (cartItemRows.length > 0) {
      await tx.insert(ecomOrderItems).values(
        cartItemRows.map((item) => ({
          orderId: order.id,
          productId: item.productId,
          quantity: item.quantity,
        }))
      );
    }

    return order;
  });
};

/**
 * Load address + non-empty cart for the authenticated user (shared by all providers).
 * @param {import("drizzle-orm/postgres-js").PostgresJsDatabase} db
 * @param {import("express").Request} req
 * @param {string} addressId
 */
const loadCheckoutContext = async (db, req, addressId) => {
  const [address] = await db
    .select()
    .from(addresses)
    .where(
      and(eq(addresses.id, addressId), eq(addresses.owner, req.user._id))
    )
    .limit(1);

  if (!address) {
    throw new ApiError(404, "Address does not exists");
  }

  const [cart] = await db
    .select()
    .from(carts)
    .where(eq(carts.owner, req.user._id))
    .limit(1);

  const cartItemCount = cart
    ? (
        await db
          .select({ value: count() })
          .from(cartItems)
          .where(eq(cartItems.cartId, cart.id))
      )[0]
    : { value: 0 };

  if (!cart || Number(cartItemCount?.value ?? 0) === 0) {
    throw new ApiError(400, "User cart is empty");
  }

  const userCart = await getCart(req.user._id);

  return {
    address,
    cart,
    userCart,
    totalPrice: userCart.cartTotal,
    totalDiscountedPrice: userCart.discountedTotal,
  };
};

/**
 * Side-effects after successful payment verify / Stripe webhook:
 * mark paid (idempotent), decrement stock, send confirmation mail, clear cart + coupon.
 * @param {string} orderPaymentId
 * @param {{ user?: { _id?: string; email?: string; username?: string } } | null} [req]
 */
const orderFulfillmentHelper = async (orderPaymentId, req = null) => {
  const db = requireDb();

  const [existing] = await db
    .select()
    .from(ecomOrders)
    .where(eq(ecomOrders.paymentId, orderPaymentId))
    .limit(1);

  if (!existing) {
    throw new ApiError(404, "Order does not exist");
  }

  if (existing.isPaymentDone) {
    return shapeOrderAddress(withId(existing));
  }

  const customerId = req?.user?._id ?? existing.customer;
  if (!customerId) {
    throw new ApiError(500, "Order has no customer");
  }

  let email = req?.user?.email;
  let username = req?.user?.username;
  if (!email || !username) {
    const [customerRow] = await db
      .select({
        email: users.email,
        username: users.username,
      })
      .from(users)
      .where(eq(users.id, customerId))
      .limit(1);
    email = email ?? customerRow?.email;
    username = username ?? customerRow?.username;
  }

  const [order] = await db
    .update(ecomOrders)
    .set({ isPaymentDone: true })
    .where(
      and(
        eq(ecomOrders.paymentId, orderPaymentId),
        eq(ecomOrders.isPaymentDone, false)
      )
    )
    .returning();

  if (!order) {
    const [paid] = await db
      .select()
      .from(ecomOrders)
      .where(eq(ecomOrders.paymentId, orderPaymentId))
      .limit(1);
    return shapeOrderAddress(withId(paid));
  }

  const userCart = await getCart(customerId);

  for (const item of userCart.items) {
    await db
      .update(products)
      .set({
        stock: sql`${products.stock} - ${item.quantity}`,
      })
      .where(eq(products.id, item.product._id));
  }

  await sendEmail({
    email,
    subject: "Order confirmed",
    mailgenContent: orderConfirmationMailgenContent(
      username,
      userCart.items,
      order.discountedOrderPrice ?? 0
    ),
  });

  const [cart] = await db
    .select()
    .from(carts)
    .where(eq(carts.owner, customerId))
    .limit(1);

  if (cart) {
    await db.delete(cartItems).where(eq(cartItems.cartId, cart.id));
    await db
      .update(carts)
      .set({ coupon: null })
      .where(eq(carts.id, cart.id));
  }

  return shapeOrderAddress(withId(order));
};

/**
 * Stripe webhook entrypoint.
 * Requires raw body + `stripe-signature`. Fulfills unpaid orders on `payment_intent.succeeded`.
 */
const handleStripeWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers["stripe-signature"];
  if (!signature) {
    throw new ApiError(400, "Missing stripe-signature header");
  }

  const rawBody = req.body;
  if (
    rawBody == null ||
    (typeof rawBody === "object" &&
      !Buffer.isBuffer(rawBody) &&
      !(rawBody instanceof Uint8Array) &&
      typeof rawBody !== "string")
  ) {
    throw new ApiError(400, "Missing raw webhook body");
  }

  if (
    (Buffer.isBuffer(rawBody) || rawBody instanceof Uint8Array) &&
    rawBody.length === 0
  ) {
    throw new ApiError(400, "Missing raw webhook body");
  }

  let event;
  try {
    event = constructStripeWebhookEvent(rawBody, String(signature));
  } catch (error) {
    throw new ApiError(
      400,
      error instanceof Error ? error.message : "Invalid webhook payload"
    );
  }

  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object;
    const paymentIntentId =
      typeof paymentIntent?.id === "string" ? paymentIntent.id : null;

    if (paymentIntentId) {
      try {
        await orderFulfillmentHelper(paymentIntentId, null);
      } catch (error) {
        // Acknowledge to Stripe; avoid retry storms on unknown/missing orders.
        logger.error(
          `Stripe webhook fulfillment failed for ${paymentIntentId}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }
  }

  return res.status(200).json({ received: true });
});

const generateStripeOrder = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { addressId } = req.body;
  const stripe = getStripeClient();
  const { address, cart, userCart, totalPrice, totalDiscountedPrice } =
    await loadCheckoutContext(db, req, addressId);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(Number(totalDiscountedPrice) * 100),
    currency: getStripeCurrency(),
    metadata: {
      receipt: nanoid(10),
      customerId: String(req.user._id),
    },
    automatic_payment_methods: { enabled: true },
  });

  if (!paymentIntent?.id) {
    throw new ApiError(
      500,
      "Something went wrong while initialising the stripe order."
    );
  }

  const unpaidOrder = await createUnpaidOrderFromCart(db, {
    address,
    customerId: req.user._id,
    cartId: cart.id,
    orderPrice: totalPrice ?? 0,
    discountedOrderPrice: totalDiscountedPrice ?? 0,
    paymentProvider: PaymentProviderEnum.STRIPE,
    paymentId: paymentIntent.id,
    couponId: userCart.coupon?._id,
  });

  if (!unpaidOrder) {
    throw new ApiError(
      500,
      "Something went wrong while initialising the stripe order."
    );
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        id: paymentIntent.id,
        client_secret: paymentIntent.client_secret,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null,
      },
      "Stripe order generated"
    )
  );
});

const verifyStripePayment = asyncHandler(async (req, res) => {
  const { stripe_payment_intent_id } = req.body;
  const stripe = getStripeClient();
  const paymentIntent = await stripe.paymentIntents.retrieve(
    stripe_payment_intent_id
  );

  if (paymentIntent?.status === "succeeded") {
    const order = await orderFulfillmentHelper(paymentIntent.id, req);
    return res
      .status(201)
      .json(new ApiResponse(201, order, "Order placed successfully"));
  }

  throw new ApiError(400, "Stripe payment not completed");
});

const generateRazorpayOrder = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { addressId } = req.body;
  const razorpayInstance = getRazorpayClient();
  const { address, cart, userCart, totalPrice, totalDiscountedPrice } =
    await loadCheckoutContext(db, req, addressId);

  const orderOptions = {
    amount: parseInt(String(totalDiscountedPrice), 10) * 100,
    currency: "INR",
    receipt: nanoid(10),
  };

  try {
    const razorpayOrder = await razorpayInstance.orders.create(orderOptions);

    if (!razorpayOrder?.id) {
      throw new ApiError(
        500,
        "Something went wrong while initialising the razorpay order."
      );
    }

    const unpaidOrder = await createUnpaidOrderFromCart(db, {
      address,
      customerId: req.user._id,
      cartId: cart.id,
      orderPrice: totalPrice ?? 0,
      discountedOrderPrice: totalDiscountedPrice ?? 0,
      paymentProvider: PaymentProviderEnum.RAZORPAY,
      paymentId: razorpayOrder.id,
      couponId: userCart.coupon?._id,
    });

    if (!unpaidOrder) {
      throw new ApiError(
        500,
        "Something went wrong while initialising the razorpay order."
      );
    }

    return res
      .status(200)
      .json(new ApiResponse(200, razorpayOrder, "Razorpay order generated"));
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error("RAZORPAY ORDER CREATE ERROR: ", error);
    throw new ApiError(
      error?.statusCode || 500,
      error?.error?.reason ||
        "Something went wrong while initialising the razorpay order."
    );
  }
});

const verifyRazorpayPayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    req.body;

  if (
    verifyRazorpaySignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    })
  ) {
    const order = await orderFulfillmentHelper(razorpay_order_id, req);
    return res
      .status(201)
      .json(new ApiResponse(201, order, "Order placed successfully"));
  }

  throw new ApiError(400, "Invalid razorpay signature");
});

const generatePaypalOrder = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { addressId } = req.body;
  const { address, cart, userCart, totalPrice, totalDiscountedPrice } =
    await loadCheckoutContext(db, req, addressId);

  const response = await paypalApi("/", {
    intent: "CAPTURE",
    purchase_units: [
      {
        amount: {
          currency_code: "USD",
          value: (totalDiscountedPrice * 0.012).toFixed(0),
        },
      },
    ],
  });

  const paypalOrder = await response.json();

  if (paypalOrder?.id) {
    const unpaidOrder = await createUnpaidOrderFromCart(db, {
      address,
      customerId: req.user._id,
      cartId: cart.id,
      orderPrice: totalPrice ?? 0,
      discountedOrderPrice: totalDiscountedPrice ?? 0,
      paymentProvider: PaymentProviderEnum.PAYPAL,
      paymentId: paypalOrder.id,
      couponId: userCart.coupon?._id,
    });

    if (unpaidOrder) {
      return res
        .status(201)
        .json(
          new ApiResponse(
            201,
            paypalOrder,
            "Paypal order generated successfully"
          )
        );
    }
  }

  console.log(
    "Make sure you have provided your PAYPAL credentials in the .env file"
  );
  throw new ApiError(
    500,
    "Something went wrong while initialising the paypal order."
  );
});

const verifyPaypalPayment = asyncHandler(async (req, res) => {
  const { orderId } = req.body;

  const response = await paypalApi(`/${orderId}/capture`, {});
  const capturedData = await response.json();

  if (capturedData?.status === "COMPLETED") {
    const order = await orderFulfillmentHelper(capturedData.id, req);

    return res
      .status(200)
      .json(new ApiResponse(200, order, "Order placed successfully"));
  }

  throw new ApiError(500, "Something went wrong with the paypal payment");
});

const updateOrderStatus = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { orderId } = req.params;
  const { status } = req.body;

  const [existing] = await db
    .select()
    .from(ecomOrders)
    .where(eq(ecomOrders.id, orderId))
    .limit(1);

  if (!existing) {
    throw new ApiError(404, "Order does not exist");
  }

  if (existing.status === OrderStatusEnum.DELIVERED) {
    throw new ApiError(400, "Order is already delivered");
  }

  await db
    .update(ecomOrders)
    .set({ status })
    .where(eq(ecomOrders.id, orderId));

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        status,
      },
      "Order status changed successfully"
    )
  );
});

const getOrderById = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { orderId } = req.params;

  const [order] = await db
    .select()
    .from(ecomOrders)
    .where(eq(ecomOrders.id, orderId))
    .limit(1);

  if (!order) {
    throw new ApiError(404, "Order does not exist");
  }

  const hydrated = await hydrateOrder(db, order, { includeItems: true });

  const { totalOrderItems: _totalOrderItems, ...orderPayload } = hydrated;

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        _id: order.id,
        order: orderPayload,
      },
      "Order fetched successfully"
    )
  );
});

const getOrderListAdmin = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { status, page = 1, limit = 10 } = req.query;

  const statusFilter =
    status && AvailableOrderStatuses.includes(status.toUpperCase())
      ? eq(ecomOrders.status, status.toUpperCase())
      : undefined;

  const result = await aggregatePaginate({
    page,
    limit,
    customLabels: {
      totalDocs: "totalOrders",
      docs: "orders",
    },
    getTotalDocs: async () => {
      const [row] = await db
        .select({ value: count() })
        .from(ecomOrders)
        .where(statusFilter);
      return Number(row?.value ?? 0);
    },
    getDocs: async ({ limit: take, offset }) => {
      const rows = await db
        .select()
        .from(ecomOrders)
        .where(statusFilter)
        .limit(take)
        .offset(offset);

      return Promise.all(
        rows.map((row) => hydrateOrder(db, row, { includeItems: false }))
      );
    },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, result, "Orders fetched successfully"));
});

export {
  generateStripeOrder,
  generateRazorpayOrder,
  generatePaypalOrder,
  verifyStripePayment,
  verifyRazorpayPayment,
  verifyPaypalPayment,
  handleStripeWebhook,
  getOrderById,
  getOrderListAdmin,
  updateOrderStatus,
};
