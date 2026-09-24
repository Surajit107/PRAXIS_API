import { Resend } from "resend";
import logger from "@/logger/winston.logger.js";

/** @typedef {{ name?: string; price?: number }} OrderEmailProduct */
/** @typedef {{ product?: OrderEmailProduct; quantity?: number }} OrderEmailItem */

export const RESEND_TEMPLATE_ALIASES = Object.freeze({
  emailVerification: "praxisapp-email-verification",
  resetPassword: "praxisapp-reset-password",
  orderConfirmation: "praxisapp-order-confirmation",
});

const DEFAULT_SUPPORT_EMAIL = "hello@asteriq.in";

/**
 * Bare RFC mailbox from `RESEND_FROM_EMAIL`.
 * Accepts `addr@dom` or `Name <addr@dom>`.
 */
const extractSenderEmail = (raw) => {
  const t = raw.trim();
  const angle = t.match(/<([^<>]+@[^<>]+)>/);
  if (angle) {
    return angle[1].trim();
  }
  return t;
};

const getSupportEmail = () =>
  process.env.RESEND_SUPPORT_EMAIL?.trim() ||
  process.env.RESEND_FROM_EMAIL?.trim()?.match(/<([^<>]+@[^<>]+)>/)?.[1] ||
  process.env.RESEND_FROM_EMAIL?.trim() ||
  DEFAULT_SUPPORT_EMAIL;

const currentYear = () => String(new Date().getFullYear());

/**
 * @param {{
 *   email: string;
 *   subject: string;
 *   templateId: string;
 *   variables?: Record<string, string | number>;
 * }} options
 */
const sendEmail = async (options) => {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromRaw = process.env.RESEND_FROM_EMAIL?.trim();
  const fromEmail = fromRaw ? extractSenderEmail(fromRaw) : null;

  if (!apiKey || !fromEmail || !fromEmail.includes("@")) {
    logger.error(
      "Email service skipped. Set RESEND_API_KEY and RESEND_FROM_EMAIL in the .env file"
    );
    return;
  }

  const resend = new Resend(apiKey);

  try {
    const { error } = await resend.emails.send({
      from: `"Praxis.app" <${fromEmail}>`,
      to: options.email,
      subject: options.subject,
      replyTo: fromEmail,
      headers: {
        "Auto-Submitted": "auto-generated",
      },
      template: {
        id: options.templateId,
        variables: options.variables ?? {},
      },
    });

    if (error) {
      logger.error(
        `Email service failed silently. Resend error: ${error.message} (${error.name})`
      );
    }
  } catch (error) {
    // Sending email is not strongly coupled to business logic — fail soft.
    logger.error(
      "Email service failed silently. Make sure you have provided your RESEND credentials in the .env file"
    );
    logger.error("Error: ", error);
  }
};

/**
 * @param {string} username
 * @param {string} verificationUrl
 */
const emailVerificationTemplateVariables = (username, verificationUrl) => ({
  USERNAME: username,
  VERIFICATION_URL: verificationUrl,
  SUPPORT_EMAIL: getSupportEmail(),
  YEAR: currentYear(),
});

/**
 * @param {string} username
 * @param {string} passwordResetUrl
 */
const resetPasswordTemplateVariables = (username, passwordResetUrl) => ({
  USERNAME: username,
  PASSWORD_RESET_URL: passwordResetUrl,
  SUPPORT_EMAIL: getSupportEmail(),
  YEAR: currentYear(),
});

/**
 * Resend templates cannot loop — pre-render order line rows as HTML.
 * @param {OrderEmailItem[]} items
 */
const renderOrderItemsHtml = (items = []) =>
  items
    .map((item) => {
      const name = item.product?.name ?? "Item";
      const quantity = item.quantity ?? 0;
      const price = item.product?.price ?? 0;
      return `<tr>
  <td style="padding:14px 16px;font-size:14px;color:#fafafa;border-bottom:1px solid rgba(255,255,255,0.06);">${name}</td>
  <td align="right" style="padding:14px 16px;font-size:14px;color:#a1a1aa;border-bottom:1px solid rgba(255,255,255,0.06);">${quantity}</td>
  <td align="right" style="padding:14px 16px;font-size:14px;color:#a1a1aa;border-bottom:1px solid rgba(255,255,255,0.06);font-variant-numeric:tabular-nums;">INR ${price}/-</td>
</tr>`;
    })
    .join("");

/**
 * @param {string} username
 * @param {string} orderId
 * @param {OrderEmailItem[]} items
 * @param {number} totalCost
 */
const orderConfirmationTemplateVariables = (
  username,
  orderId,
  items,
  totalCost
) => ({
  USERNAME: username,
  ORDER_ID: orderId,
  ORDER_ITEMS_HTML: renderOrderItemsHtml(items),
  TOTAL_COST: String(totalCost),
  SUPPORT_EMAIL: getSupportEmail(),
  YEAR: currentYear(),
});

export {
  sendEmail,
  emailVerificationTemplateVariables,
  resetPasswordTemplateVariables,
  orderConfirmationTemplateVariables,
  renderOrderItemsHtml,
};
