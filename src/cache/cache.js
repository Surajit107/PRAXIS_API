import { getRedisClient, isRedisReady, redisKey } from "@/cache/redis.js";
import logger from "@/logger/winston.logger.js";

/** Default TTL for public/seed-backed payloads (seconds). */
export const DEFAULT_CACHE_TTL_SECONDS = 60 * 60; // 1 hour

/**
 * Envelope so JSON `null` payloads are distinguishable from a cache miss.
 * @param {unknown} value
 */
const wrap = (value) => JSON.stringify({ v: value });

/**
 * @param {string} raw
 * @returns {{ hit: true, value: unknown } | { hit: false }}
 */
const unwrap = (raw) => {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && "v" in parsed) {
      return { hit: true, value: parsed.v };
    }
    // Legacy / non-envelope values
    return { hit: true, value: parsed };
  } catch {
    return { hit: false };
  }
};

/**
 * @param {string} keySuffix
 * @returns {Promise<{ hit: true, value: unknown } | { hit: false }>}
 */
export const cacheGetEntry = async (keySuffix) => {
  if (!isRedisReady()) return { hit: false };

  try {
    const raw = await getRedisClient().get(redisKey(keySuffix));
    if (raw == null) return { hit: false };
    return unwrap(raw);
  } catch (error) {
    logger.warn(`cacheGet failed (${keySuffix}): ${error?.message || error}`);
    return { hit: false };
  }
};

/**
 * @param {string} keySuffix
 * @returns {Promise<unknown | null>} null on miss (cannot represent cached null)
 */
export const cacheGet = async (keySuffix) => {
  const entry = await cacheGetEntry(keySuffix);
  return entry.hit ? entry.value : null;
};

/**
 * @param {string} keySuffix
 * @param {unknown} value
 * @param {number} [ttlSeconds]
 * @returns {Promise<boolean>}
 */
export const cacheSet = async (
  keySuffix,
  value,
  ttlSeconds = DEFAULT_CACHE_TTL_SECONDS
) => {
  if (!isRedisReady()) return false;

  try {
    const payload = wrap(value);
    const key = redisKey(keySuffix);
    if (ttlSeconds > 0) {
      await getRedisClient().set(key, payload, "EX", ttlSeconds);
    } else {
      await getRedisClient().set(key, payload);
    }
    return true;
  } catch (error) {
    logger.warn(`cacheSet failed (${keySuffix}): ${error?.message || error}`);
    return false;
  }
};

/**
 * @param {string} keySuffix
 * @returns {Promise<boolean>}
 */
export const cacheDel = async (keySuffix) => {
  if (!isRedisReady()) return false;

  try {
    await getRedisClient().del(redisKey(keySuffix));
    return true;
  } catch (error) {
    logger.warn(`cacheDel failed (${keySuffix}): ${error?.message || error}`);
    return false;
  }
};

/**
 * Delete all keys matching `praxisapi:{suffixPrefix}*`.
 * Uses SCAN so production Redis is not blocked by KEYS.
 * @param {string} suffixPrefix
 * @returns {Promise<number>} deleted count
 */
export const cacheDelByPrefix = async (suffixPrefix) => {
  if (!isRedisReady()) return 0;

  const client = getRedisClient();
  const match = redisKey(`${suffixPrefix}*`);
  let deleted = 0;

  try {
    let cursor = "0";
    do {
      const [nextCursor, keys] = await client.scan(
        cursor,
        "MATCH",
        match,
        "COUNT",
        100
      );
      cursor = nextCursor;
      if (keys.length > 0) {
        deleted += await client.del(...keys);
      }
    } while (cursor !== "0");
  } catch (error) {
    logger.warn(
      `cacheDelByPrefix failed (${suffixPrefix}): ${error?.message || error}`
    );
  }

  return deleted;
};

/**
 * Cache-aside helper. On Redis miss/error, loads from `loader` and best-effort stores.
 * @template T
 * @param {string} keySuffix
 * @param {() => Promise<T>} loader
 * @param {number} [ttlSeconds]
 * @returns {Promise<T>}
 */
export const cacheGetOrSet = async (
  keySuffix,
  loader,
  ttlSeconds = DEFAULT_CACHE_TTL_SECONDS
) => {
  const entry = await cacheGetEntry(keySuffix);
  if (entry.hit) {
    return /** @type {T} */ (entry.value);
  }

  const value = await loader();
  await cacheSet(keySuffix, value, ttlSeconds);
  return value;
};
