import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import session from "express-session";
import fs from "fs";
import { createServer } from "http";
import passport from "passport";
import path from "path";
import requestIp from "request-ip";
import { Server } from "socket.io";
import swaggerUi from "swagger-ui-express";
import { fileURLToPath } from "url";
import YAML from "yaml";
import { sql } from "drizzle-orm";
import { PraxisRedisStore } from "@/cache/sessionStore.js";
import { attachConnectTeachingHandler } from "@/controllers/kitchen-sink/connectTeaching.handler.js";
import { dbInstance } from "@/db/index.js";
import morganMiddleware from "@/logger/morgan.logger.js";
import logger from "@/logger/winston.logger.js";
import { initializeSocketIO } from "@/socket/index.js";
import { ApiError } from "@/utils/ApiError.js";
import { ApiResponse } from "@/utils/ApiResponse.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const file = fs.readFileSync(path.resolve(__dirname, "./swagger.yaml"), "utf8");
const swaggerDocument = YAML.parse(
  file?.replace(
    "- url: ${{server}}",
    `- url: ${process.env.PRAXIS_API_HOST_URL || "http://localhost:8000"}/api/v1`
  )
);

// Hide YouTube paths from Swagger UI (copyright). Definitions remain in swagger.yaml.
if (swaggerDocument?.paths) {
  for (const pathKey of Object.keys(swaggerDocument.paths)) {
    if (pathKey.includes("/youtube")) {
      delete swaggerDocument.paths[pathKey];
    }
  }
}

const app = express();

// Needed behind Render / reverse proxies so secure cookies and client IPs work.
app.set("trust proxy", 1);

const httpServer = createServer(app);

// CONNECT is not delivered via Express `request` — attach teaching stub on the raw server.
attachConnectTeachingHandler(httpServer);

const io = new Server(httpServer, {
  pingTimeout: 60000,
  cors: {
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  },
});

app.set("io", io); // using set method to mount the `io` instance on the app to avoid usage of `global`

// global middlewares
const corsOrigin =
  process.env.CORS_ORIGIN === "*"
    ? "*" // This might give CORS error for some origins due to credentials set to true
    : process.env.CORS_ORIGIN?.split(","); // Multiple origins: comma-separated in CORS_ORIGIN

const corsMiddleware = cors({
  origin: corsOrigin,
  credentials: true,
});

/**
 * `cors` ends every OPTIONS with 204 before routes run. Bypass that short-circuit for the
 * kitchen-sink OPTIONS teaching endpoint so students can inspect Allow + JSON body.
 * Real CORS preflights on all other paths keep the default behaviour.
 */
const kitchenSinkOptionsCors = cors({
  origin: corsOrigin,
  credentials: true,
  preflightContinue: true,
  methods: [
    "GET",
    "HEAD",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
    "TRACE",
    "CONNECT",
  ],
});

app.use((req, res, next) => {
  const isKitchenSinkOptionsLesson =
    req.method === "OPTIONS" &&
    req.path.replace(/\/$/, "") === "/api/v1/kitchen-sink/http-methods/options";

  if (isKitchenSinkOptionsLesson) {
    return kitchenSinkOptionsCors(req, res, next);
  }

  return corsMiddleware(req, res, next);
});

app.use(requestIp.mw());

// Rate limiter to avoid misuse of the service and avoid cost spikes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // Limit each IP to 500 requests per `window` (here, per 15 minutes)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (req) => {
    // Normalize IPv6 so users cannot rotate addresses within a subnet to bypass limits
    return ipKeyGenerator(req.clientIp); // IP from requestIp.mw(), not req.ip
  },
  handler: (_, __, ___, options) => {
    throw new ApiError(
      options.statusCode || 500,
      `There are too many requests. You are only allowed ${
        options.max
      } requests per ${options.windowMs / 60000} minutes`
    );
  },
});

// Apply the rate limiting middleware to all requests
app.use(limiter);

// Stripe webhook: raw body required for signature verification.
// Mount BEFORE express.json — Dashboard → Webhooks → POST {HOST}/stripe/webhook
app.post(
  "/stripe/webhook",
  express.raw({ type: "application/json" }),
  handleStripeWebhook
);

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public")); // configure static file to save images locally
app.use(cookieParser());

// required for passport (OAuth). Prefer Redis store — MemoryStore is not production-safe.
const isProduction = process.env.NODE_ENV === "production";
const hasRedisUrl = Boolean(process.env.REDIS_URL?.trim());

/** @type {import("express-session").SessionOptions} */
const sessionOptions = {
  secret: process.env.EXPRESS_SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  name: "praxis.sid",
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: 24 * 60 * 60 * 1000,
  },
};

if (hasRedisUrl) {
  sessionOptions.store = new PraxisRedisStore({
    prefix: "sess:",
    ttl: 86_400,
  });
} else {
  logger.warn(
    "REDIS_URL unset — express-session is using MemoryStore (not production-safe)"
  );
}

app.use(session(sessionOptions));
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions

app.use(morganMiddleware);
// api routes
import { errorHandler } from "@/middlewares/error.middlewares.js";
import healthcheckRouter from "@/routes/healthcheck.routes.js";
import { handleStripeWebhook } from "@/controllers/apps/ecommerce/order.controllers.js";

// * Public routes
import bookRouter from "@/routes/public/book.routes.js";
import catRouter from "@/routes/public/cat.routes.js";
import dogRouter from "@/routes/public/dog.routes.js";
import mealRouter from "@/routes/public/meal.routes.js";
import quoteRouter from "@/routes/public/quote.routes.js";
import randomjokeRouter from "@/routes/public/randomjoke.routes.js";
import randomproductRouter from "@/routes/public/randomproduct.routes.js";
import randomuserRouter from "@/routes/public/randomuser.routes.js";
import stockRouter from "@/routes/public/stock.routes.js";
import geoRouter from "@/routes/public/geo.routes.js";
import companyRouter from "@/routes/public/company.routes.js";
import customerRouter from "@/routes/public/customer.routes.js";
import employeeRouter from "@/routes/public/employee.routes.js";
import inventoryRouter from "@/routes/public/inventory.routes.js";
import publicOrderRouter from "@/routes/public/order.routes.js";
import ticketRouter from "@/routes/public/ticket.routes.js";
import invoiceRouter from "@/routes/public/invoice.routes.js";
import shipmentRouter from "@/routes/public/shipment.routes.js";
import transactionRouter from "@/routes/public/transaction.routes.js";
import projectRouter from "@/routes/public/project.routes.js";
import subscriptionRouter from "@/routes/public/subscription.routes.js";
import appointmentRouter from "@/routes/public/appointment.routes.js";
// YouTube controllers use static JSON under src/json/youtube/.
// Mount disabled — bundled payloads are copyrighted third-party content.
// import youtubeRouter from "@/routes/public/youtube.routes.js";

// * App routes
import userRouter from "@/routes/apps/auth/user.routes.js";

import addressRouter from "@/routes/apps/ecommerce/address.routes.js";
import cartRouter from "@/routes/apps/ecommerce/cart.routes.js";
import categoryRouter from "@/routes/apps/ecommerce/category.routes.js";
import couponRouter from "@/routes/apps/ecommerce/coupon.routes.js";
import orderRouter from "@/routes/apps/ecommerce/order.routes.js";
import productRouter from "@/routes/apps/ecommerce/product.routes.js";
import ecomProfileRouter from "@/routes/apps/ecommerce/profile.routes.js";

import socialBookmarkRouter from "@/routes/apps/social-media/bookmark.routes.js";
import socialCommentRouter from "@/routes/apps/social-media/comment.routes.js";
import socialFollowRouter from "@/routes/apps/social-media/follow.routes.js";
import socialLikeRouter from "@/routes/apps/social-media/like.routes.js";
import socialPostRouter from "@/routes/apps/social-media/post.routes.js";
import socialProfileRouter from "@/routes/apps/social-media/profile.routes.js";

import chatRouter from "@/routes/apps/chat-app/chat.routes.js";
import messageRouter from "@/routes/apps/chat-app/message.routes.js";

import todoRouter from "@/routes/apps/todo/todo.routes.js";

// * Kitchen sink routes
import cookieRouter from "@/routes/kitchen-sink/cookie.routes.js";
import httpmethodRouter from "@/routes/kitchen-sink/httpmethod.routes.js";
import imageRouter from "@/routes/kitchen-sink/image.routes.js";
import redirectRouter from "@/routes/kitchen-sink/redirect.routes.js";
import requestinspectionRouter from "@/routes/kitchen-sink/requestinspection.routes.js";
import responseinspectionRouter from "@/routes/kitchen-sink/responseinspection.routes.js";
import statuscodeRouter from "@/routes/kitchen-sink/statuscode.routes.js";

// * Seeding handlers
import { avoidInProduction } from "@/middlewares/auth.middlewares.js";
import { seedChatApp } from "@/seeds/chat-app.seeds.js";
import { seedEcommerce } from "@/seeds/ecommerce.seeds.js";
import { seedSocialMedia } from "@/seeds/social-media.seeds.js";
import { seedTodos } from "@/seeds/todo.seeds.js";
import { getGeneratedCredentials, seedUsers } from "@/seeds/user.seeds.js";

// * system (healthcheck, live, ready, version)
app.use("/api/v1", healthcheckRouter);

// * Public apis
// TODO: More functionality specific to the type of api, can be added in the future
app.use("/api/v1/public/randomusers", randomuserRouter);
app.use("/api/v1/public/randomproducts", randomproductRouter);
app.use("/api/v1/public/randomjokes", randomjokeRouter);
app.use("/api/v1/public/books", bookRouter);
app.use("/api/v1/public/quotes", quoteRouter);
app.use("/api/v1/public/meals", mealRouter);
app.use("/api/v1/public/dogs", dogRouter);
app.use("/api/v1/public/cats", catRouter);
// YouTube controllers exist; route intentionally not mounted (copyright).
// app.use("/api/v1/public/youtube", youtubeRouter);
app.use("/api/v1/public/stocks", stockRouter);
app.use("/api/v1/public/geo", geoRouter);
app.use("/api/v1/public/companies", companyRouter);
app.use("/api/v1/public/customers", customerRouter);
app.use("/api/v1/public/employees", employeeRouter);
app.use("/api/v1/public/inventory", inventoryRouter);
app.use("/api/v1/public/orders", publicOrderRouter);
app.use("/api/v1/public/tickets", ticketRouter);
app.use("/api/v1/public/invoices", invoiceRouter);
app.use("/api/v1/public/shipments", shipmentRouter);
app.use("/api/v1/public/transactions", transactionRouter);
app.use("/api/v1/public/projects", projectRouter);
app.use("/api/v1/public/subscriptions", subscriptionRouter);
app.use("/api/v1/public/appointments", appointmentRouter);

// * App apis
app.use("/api/v1/users", userRouter);

app.use("/api/v1/ecommerce/categories", categoryRouter);
app.use("/api/v1/ecommerce/addresses", addressRouter);
app.use("/api/v1/ecommerce/products", productRouter);
app.use("/api/v1/ecommerce/profile", ecomProfileRouter);
app.use("/api/v1/ecommerce/cart", cartRouter);
app.use("/api/v1/ecommerce/orders", orderRouter);
app.use("/api/v1/ecommerce/coupons", couponRouter);

app.use("/api/v1/social-media/profile", socialProfileRouter);
app.use("/api/v1/social-media/follow", socialFollowRouter);
app.use("/api/v1/social-media/posts", socialPostRouter);
app.use("/api/v1/social-media/like", socialLikeRouter);
app.use("/api/v1/social-media/bookmarks", socialBookmarkRouter);
app.use("/api/v1/social-media/comments", socialCommentRouter);

app.use("/api/v1/chat-app/chats", chatRouter);
app.use("/api/v1/chat-app/messages", messageRouter);

app.use("/api/v1/todos", todoRouter);

// * Kitchen sink apis
app.use("/api/v1/kitchen-sink/http-methods", httpmethodRouter);
app.use("/api/v1/kitchen-sink/status-codes", statuscodeRouter);
app.use("/api/v1/kitchen-sink/request", requestinspectionRouter);
app.use("/api/v1/kitchen-sink/response", responseinspectionRouter);
app.use("/api/v1/kitchen-sink/cookies", cookieRouter);
app.use("/api/v1/kitchen-sink/redirect", redirectRouter);
app.use("/api/v1/kitchen-sink/image", imageRouter);

// * Seeding (dev-only — blocked when NODE_ENV !== "development")
app.get(
  "/api/v1/seed/generated-credentials",
  avoidInProduction,
  getGeneratedCredentials
);
app.post("/api/v1/seed/todos", avoidInProduction, seedTodos);
app.post(
  "/api/v1/seed/ecommerce",
  avoidInProduction,
  seedUsers,
  seedEcommerce
);
app.post(
  "/api/v1/seed/social-media",
  avoidInProduction,
  seedUsers,
  seedSocialMedia
);
app.post(
  "/api/v1/seed/chat-app",
  avoidInProduction,
  seedUsers,
  seedChatApp
);

initializeSocketIO(io);

// ! 🚫 Danger Zone
// Wipe *app* data (keep schema + public JSON + geo). Full schema drop: `npm run db:drop-all`.
app.delete("/api/v1/reset-db", avoidInProduction, async (req, res) => {
  if (!dbInstance) {
    throw new ApiError(500, "Something went wrong while dropping the database");
  }

  try {
    // Truncate app tables only. Never touch reference datasets or migration journal.
    // CASCADE clears FK order issues among truncated tables.
    await dbInstance.execute(sql.raw(`
      DO $$
      DECLARE
        stmt text;
      BEGIN
        SELECT 'TRUNCATE TABLE ' || string_agg(format('%I.%I', schemaname, tablename), ', ')
          || ' RESTART IDENTITY CASCADE'
        INTO stmt
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename NOT IN (
            '__drizzle_migrations',
            'public_json_docs',
            'geo_countries',
            'geo_states',
            'geo_cities'
          );

        IF stmt IS NOT NULL THEN
          EXECUTE stmt;
        END IF;
      END $$;
    `));

    const directory = "./public/images";

    // Remove all product images from the file system
    fs.readdir(directory, (err, files) => {
      if (err) {
        // fail silently
        logger.error("Error while removing the images: ", err);
      } else {
        for (const file of files) {
          if (file === ".gitkeep") continue;
          fs.unlink(path.join(directory, file), (err) => {
            if (err) throw err;
          });
        }
      }
    });
    // remove the seeded users if exist
    fs.unlink("./public/temp/seed-credentials.json", (err) => {
      // fail silently
      if (err) logger.error("Seed credentials are missing.");
    });

    return res
      .status(200)
      .json(new ApiResponse(200, null, "Database dropped successfully"));
  } catch (error) {
    logger.error("Error while resetting the database: ", error);
    throw new ApiError(500, "Something went wrong while dropping the database");
  }
});

// * API DOCS
app.use(
  "/docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument, {
    swaggerOptions: {
      docExpansion: "none", // keep all the sections collapsed by default
    },
    customSiteTitle: "Praxis API docs",
  })
);

// common error handling middleware
app.use(errorHandler);

export { app, httpServer };
