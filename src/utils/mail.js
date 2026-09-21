import Mailgen from "mailgen";
import { Resend } from "resend";
import { Product } from "@/models/apps/ecommerce/product.models.js";
import logger from "@/logger/winston.logger.js";

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

/**
 *
 * @param {{email: string; subject: string; mailgenContent: Mailgen.Content; }} options
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

  // Initialize mailgen instance with default theme and brand configuration
  const mailGenerator = new Mailgen({
    theme: "default",
    product: {
      name: "PraxisAPI",
      link: process.env.PRAXIS_API_HOST_URL || "http://localhost:8000",
    },
  });

  // For more info on how mailgen content work visit https://github.com/eladnava/mailgen#readme
  // Generate the plaintext version of the e-mail (for clients that do not support HTML)
  const emailTextual = mailGenerator.generatePlaintext(options.mailgenContent);

  // Generate an HTML email with the provided contents
  const emailHtml = mailGenerator.generate(options.mailgenContent);

  const resend = new Resend(apiKey);

  try {
    const { error } = await resend.emails.send({
      from: `"PraxisAPI" <${fromEmail}>`,
      to: options.email,
      subject: options.subject,
      text: emailTextual,
      html: emailHtml,
      replyTo: fromEmail,
      headers: {
        "Auto-Submitted": "auto-generated",
      },
    });

    if (error) {
      logger.error(
        `Email service failed silently. Resend error: ${error.message} (${error.name})`
      );
    }
  } catch (error) {
    // As sending email is not strongly coupled to the business logic it is not worth to raise an error when email sending fails
    // So it's better to fail silently rather than breaking the app
    logger.error(
      "Email service failed silently. Make sure you have provided your RESEND credentials in the .env file"
    );
    logger.error("Error: ", error);
  }
};

/**
 *
 * @param {string} username
 * @param {string} verificationUrl
 * @returns {Mailgen.Content}
 * @description It designs the email verification mail
 */
const emailVerificationMailgenContent = (username, verificationUrl) => {
  return {
    body: {
      name: username,
      intro: "Welcome to our app! We're very excited to have you on board.",
      action: {
        instructions:
          "To verify your email please click on the following button:",
        button: {
          color: "#22BC66", // Optional action button color
          text: "Verify your email",
          link: verificationUrl,
        },
      },
      outro:
        "Need help, or have questions? Just reply to this email, we'd love to help.",
    },
  };
};

/**
 *
 * @param {string} username
 * @param {string} verificationUrl
 * @returns {Mailgen.Content}
 * @description It designs the forgot password mail
 */
const forgotPasswordMailgenContent = (username, passwordResetUrl) => {
  return {
    body: {
      name: username,
      intro: "We got a request to reset the password of our account",
      action: {
        instructions:
          "To reset your password click on the following button or link:",
        button: {
          color: "#22BC66", // Optional action button color
          text: "Reset password",
          link: passwordResetUrl,
        },
      },
      outro:
        "Need help, or have questions? Just reply to this email, we'd love to help.",
    },
  };
};

/**
 *
 * @param {string} username
 * @param {{_id: string, product: Product, quantity: number}[]} items
 * @param {number} totalCost
 * @returns {Mailgen.Content}
 * @description It designs the order creation invoice mail
 */
const orderConfirmationMailgenContent = (username, items, totalCost) => {
  return {
    body: {
      name: username,
      intro: "Your order has been processed successfully.",
      table: {
        data: items?.map((item) => {
          return {
            item: item.product?.name,
            price: "INR " + item.product?.price + "/-",
            quantity: item.quantity,
          };
        }),
        columns: {
          // Optionally, customize the column widths
          customWidth: {
            item: "20%",
            price: "15%",
            quantity: "15%",
          },
          // Optionally, change column text alignment
          customAlignment: {
            price: "right",
            quantity: "right",
          },
        },
      },
      outro: [
        `Total order cost: INR ${totalCost}/-`,
        "You can check the status of your order and more in your order history",
      ],
    },
  };
};

export {
  sendEmail,
  emailVerificationMailgenContent,
  forgotPasswordMailgenContent,
  orderConfirmationMailgenContent,
};
