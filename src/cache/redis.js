import Redis from "ioredis";
import logger from "@/logger/winston.logger.js";

/** @type {import("ioredis").default | null} */
let redisClient = null;

/** @type {boolean} */
let connectAttempted = false;

/**
 * @returns {boolean}
 */
const isJest = () => typeof process.env.JEST_WORKER_ID !== "undefined";

/**
 * Shared Render Key Value with AI-FEEDBACK — always namespace keys.
 * @returns {string}
 */
export const getRedisKeyPrefix = () =>
  (process.env.REDIS_KEY_PREFIX || "praxisapi:").trim() || "praxisapi:";

/**
 * @param {string} suffix
 * @returns {string}
 */
export const redisKey = (suffix) => `${getRedisKeyPrefix()}${suffix}`;

/**
 * @returns {import("ioredis").default | null}
 */
export const getRedisClient = () => redisClient;

/**
 * @returns {boolean}
 */
export const isRedisReady = () =>
  Boolean(redisClient && redisClient.status === "ready");

/**
 * Connect to Redis when REDIS_URL is set. Used for public JSON caching and
 * express-session (OAuth). Caching fails open if Redis is missing/unreachable;
 * session writes will error until Redis is healthy again. Skipped under Jest.
 * @returns {Promise<import("ioredis").default | null>}
 */
export const connectRedis = async () => {
  if (isJest()) {
    return null;
  }

  if (redisClient && redisClient.status === "ready") {
    return redisClient;
  }

  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) {
    if (!connectAttempted) {
      logger.warn("REDIS_URL not set — caching disabled");
      connectAttempted = true;
    }
    return null;
  }

  connectAttempted = true;

  try {
    if (redisClient) {
      try {
        await redisClient.quit();
      } catch {
        /* ignore */
      }
      redisClient = null;
    }

    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      lazyConnect: true,
      connectTimeout: 10_000,
      // Avoid endless reconnect spam if Redis is down; caching stays optional
      retryStrategy: (times) => {
        if (times > 5) return null;
        return Math.min(times * 200, 2000);
      },
    });

    client.on("error", (err) => {
      logger.error(`Redis error: ${err?.message || err}`);
    });

    await client.connect();
    await client.ping();

    redisClient = client;
    logger.info("\n⚡  Redis Connected!\n");
    return redisClient;
  } catch (error) {
    logger.error("Redis connection error (caching disabled): ", error);
    if (redisClient) {
      try {
        redisClient.disconnect();
      } catch {
        /* ignore */
      }
      redisClient = null;
    }
    return null;
  }
};

/**
 * Close the Redis connection (boot teardown / scripts).
 */
export const disconnectRedis = async () => {
  if (!redisClient) return;

  const client = redisClient;
  redisClient = null;
  connectAttempted = false;

  try {
    await client.quit();
  } catch {
    try {
      client.disconnect();
    } catch {
      /* ignore */
    }
  }
};

export default connectRedis;
