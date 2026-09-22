import dotenv from "dotenv";
import { httpServer } from "@/app.js";
import connectRedis from "@/cache/redis.js";
import connectDB from "@/db/index.js";
import logger from "@/logger/winston.logger.js";

dotenv.config({
  path: "./.env",
});

/**
 * Starting from Node.js v14 top-level await is available and it is only available in ES modules.
 * This means you can not use it with common js modules or Node version < 14.
 */
const majorNodeVersion = +process.env.NODE_VERSION?.split(".")[0] || 0;

const startServer = () => {
  httpServer.listen(process.env.PORT || 8000, () => {
    logger.info(
      `📑 Visit the documentation at: http://localhost:${
        process.env.PORT || 8000
      }/docs`
    );
    logger.info("⚙️  Server is running on port: " + process.env.PORT);
  });
};

/**
 * Postgres is required; Redis is optional for caching but used for sessions
 * when REDIS_URL is set (avoids express-session MemoryStore on live).
 */
const boot = async () => {
  await connectDB();
  await connectRedis();
  startServer();
};

if (majorNodeVersion >= 14) {
  try {
    await boot();
  } catch (err) {
    logger.error("PostgreSQL connect error: ", err);
  }
} else {
  boot().catch((err) => {
    logger.error("PostgreSQL connect error: ", err);
  });
}
