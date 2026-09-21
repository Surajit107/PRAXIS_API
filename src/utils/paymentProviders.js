import crypto from "crypto";
import Razorpay from "razorpay";
import Stripe from "stripe";
import { paypalBaseUrl } from "@/constants.js";
import { ApiError } from "@/utils/ApiError.js";

/**
 * @param {string | undefined | null} value
 */
const isMissingOrPlaceholder = (value) => {
  if (value == null) {
    return true;
  }
  const trimmed = String(value).trim();
  if (!trimmed) {
    return true;
  }
  return trimmed.startsWith("__") && trimmed.endsWith("__");
};

/** @type {Stripe | null} */
let stripeClient = null;
/** @type {InstanceType<typeof Razorpay> | null} */
let razorpayClient = null;

/** @type {Stripe | null} */
let stripeOverride = null;
/** @type {InstanceType<typeof Razorpay> | null} */
let razorpayOverride = null;
/**
 * @type {null | ((endpoint: string, body?: Record<string, unknown>) => Promise<Response>)}
 */
let paypalApiOverride = null;
/**
 * @type {null | ((rawBody: Buffer | string, signature: string) => import("stripe").Stripe.Event)}
 */
let stripeConstructEventOverride = null;

/**
 * Jest hooks — inject mocked provider SDKs (no live charges).
 * @param {{
 *   stripe?: Stripe | null;
 *   razorpay?: InstanceType<typeof Razorpay> | null;
 *   paypalApi?: null | ((endpoint: string, body?: Record<string, unknown>) => Promise<Response>);
 *   stripeConstructEvent?: null | ((rawBody: Buffer | string, signature: string) => import("stripe").Stripe.Event);
 * }} [mocks]
 */
export const __setPaymentProviderMocksForTests = (mocks = {}) => {
  if ("stripe" in mocks) {
    stripeOverride = mocks.stripe ?? null;
  }
  if ("razorpay" in mocks) {
    razorpayOverride = mocks.razorpay ?? null;
  }
  if ("paypalApi" in mocks) {
    paypalApiOverride = mocks.paypalApi ?? null;
  }
  if ("stripeConstructEvent" in mocks) {
    stripeConstructEventOverride = mocks.stripeConstructEvent ?? null;
  }
};

export const __resetPaymentProviderMocksForTests = () => {
  stripeOverride = null;
  razorpayOverride = null;
  paypalApiOverride = null;
  stripeConstructEventOverride = null;
};

/**
 * @returns {Stripe}
 */
export const getStripeClient = () => {
  if (stripeOverride) {
    return stripeOverride;
  }
  if (stripeClient) {
    return stripeClient;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (isMissingOrPlaceholder(secretKey)) {
    throw new ApiError(
      500,
      "Stripe is not configured. Set STRIPE_SECRET_KEY in the .env file"
    );
  }

  stripeClient = new Stripe(secretKey);
  return stripeClient;
};

/**
 * @returns {string}
 */
export const getStripeWebhookSecret = () => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (isMissingOrPlaceholder(secret)) {
    throw new ApiError(
      500,
      "Stripe webhook is not configured. Set STRIPE_WEBHOOK_SECRET in the .env file"
    );
  }
  return secret;
};

/**
 * Verify Stripe webhook signature (constructEvent + whsec).
 * @param {Buffer | string} rawBody
 * @param {string} signature
 * @returns {import("stripe").Stripe.Event}
 */
export const constructStripeWebhookEvent = (rawBody, signature) => {
  if (stripeConstructEventOverride) {
    return stripeConstructEventOverride(rawBody, signature);
  }

  const stripe = getStripeClient();
  return stripe.webhooks.constructEvent(
    rawBody,
    signature,
    getStripeWebhookSecret()
  );
};

/**
 * @returns {InstanceType<typeof Razorpay>}
 */
export const getRazorpayClient = () => {
  if (razorpayOverride) {
    return razorpayOverride;
  }
  if (razorpayClient) {
    return razorpayClient;
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (isMissingOrPlaceholder(keyId) || isMissingOrPlaceholder(keySecret)) {
    throw new ApiError(
      500,
      "Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the .env file"
    );
  }

  razorpayClient = new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
  return razorpayClient;
};

/**
 * @param {{ orderId: string; paymentId: string; signature: string }} payload
 */
export const verifyRazorpaySignature = ({ orderId, paymentId, signature }) => {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (isMissingOrPlaceholder(keySecret)) {
    throw new ApiError(
      500,
      "Razorpay is not configured. Set RAZORPAY_KEY_SECRET in the .env file"
    );
  }

  const body = `${orderId}|${paymentId}`;
  const expectedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(body)
    .digest("hex");

  return expectedSignature === signature;
};

const generatePaypalAccessToken = async () => {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_SECRET;
  if (isMissingOrPlaceholder(clientId) || isMissingOrPlaceholder(secret)) {
    throw new ApiError(
      500,
      "PayPal is not configured. Set PAYPAL_CLIENT_ID and PAYPAL_SECRET in the .env file"
    );
  }

  try {
    const auth = Buffer.from(`${clientId}:${secret}`).toString("base64");
    const response = await fetch(`${paypalBaseUrl.sandbox}/v1/oauth2/token`, {
      method: "POST",
      body: "grant_type=client_credentials",
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });
    const data = await response.json();
    return data?.access_token;
  } catch {
    throw new ApiError(500, "Error while generating paypal auth token");
  }
};

/**
 * @param {string} endpoint
 * @param {Record<string, unknown>} [body]
 */
export const paypalApi = async (endpoint, body = {}) => {
  if (paypalApiOverride) {
    return paypalApiOverride(endpoint, body);
  }

  const accessToken = await generatePaypalAccessToken();
  return fetch(`${paypalBaseUrl.sandbox}/v2/checkout/orders${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });
};

/**
 * @returns {string}
 */
export const getStripeCurrency = () =>
  String(process.env.STRIPE_CURRENCY || "inr")
    .trim()
    .toLowerCase();
