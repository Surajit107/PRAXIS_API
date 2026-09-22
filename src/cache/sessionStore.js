import session from "express-session";
import { getRedisClient, redisKey } from "@/cache/redis.js";

const DEFAULT_TTL_SECONDS = 86_400;

/**
 * express-session Store backed by the shared ioredis client.
 * Resolves the client per operation so boot can connect Redis after middleware
 * registration (see src/index.js). No-ops reads when Redis is unavailable.
 */
export class PraxisRedisStore extends session.Store {
  /**
   * @param {{ prefix?: string, ttl?: number }} [options]
   */
  constructor(options = {}) {
    super();
    this.prefix = options.prefix ?? "sess:";
    this.ttl = options.ttl ?? DEFAULT_TTL_SECONDS;
  }

  /**
   * @param {string} sid
   * @returns {string}
   */
  #key(sid) {
    return redisKey(`${this.prefix}${sid}`);
  }

  /**
   * @param {import("express-session").SessionData} sess
   * @returns {number}
   */
  #ttlSeconds(sess) {
    const expires = sess?.cookie?.expires;
    if (expires) {
      const ms = Number(new Date(expires)) - Date.now();
      return Math.max(1, Math.ceil(ms / 1000));
    }
    return this.ttl;
  }

  /**
   * @param {string} sid
   * @param {(err: Error | null, session?: import("express-session").SessionData | null) => void} callback
   */
  get(sid, callback) {
    const client = getRedisClient();
    if (!client) {
      callback(null, null);
      return;
    }

    client
      .get(this.#key(sid))
      .then((data) => {
        if (!data) {
          callback(null, null);
          return;
        }
        callback(null, JSON.parse(data));
      })
      .catch((err) => callback(err));
  }

  /**
   * @param {string} sid
   * @param {import("express-session").SessionData} sess
   * @param {(err?: Error) => void} callback
   */
  set(sid, sess, callback) {
    const client = getRedisClient();
    if (!client) {
      callback(new Error("Redis session store is unavailable"));
      return;
    }

    const ttl = this.#ttlSeconds(sess);
    const payload = JSON.stringify(sess);
    const key = this.#key(sid);

    const write =
      ttl > 0
        ? client.set(key, payload, "EX", ttl)
        : client.set(key, payload);

    write
      .then(() => callback())
      .catch((err) => callback(err));
  }

  /**
   * @param {string} sid
   * @param {(err?: Error) => void} callback
   */
  destroy(sid, callback) {
    const client = getRedisClient();
    if (!client) {
      callback();
      return;
    }

    client
      .del(this.#key(sid))
      .then(() => callback())
      .catch((err) => callback(err));
  }

  /**
   * @param {string} sid
   * @param {import("express-session").SessionData} sess
   * @param {(err?: Error) => void} callback
   */
  touch(sid, sess, callback) {
    const client = getRedisClient();
    if (!client) {
      callback();
      return;
    }

    const ttl = this.#ttlSeconds(sess);
    if (ttl <= 0) {
      callback();
      return;
    }

    client
      .expire(this.#key(sid), ttl)
      .then(() => callback())
      .catch((err) => callback(err));
  }
}
