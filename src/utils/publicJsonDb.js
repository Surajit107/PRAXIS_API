import { and, eq, sql } from "drizzle-orm";
import { cacheDelByPrefix, cacheGetOrSet } from "@/cache/cache.js";
import { dbInstance } from "@/db/index.js";
import { publicJsonDocs } from "@/models/public/public-json.models.js";

/** Seed-backed collections change rarely — 1 hour TTL. */
const PUBLIC_JSON_TTL_SECONDS = 60 * 60;

/**
 * @returns {import("drizzle-orm/postgres-js").PostgresJsDatabase}
 */
const getDb = () => {
  if (!dbInstance) {
    throw new Error("Database is not connected");
  }
  return dbInstance;
};

/**
 * @param {string} collection
 * @returns {string}
 */
const listCacheKey = (collection) => `public-json:list:${collection}`;

/**
 * @param {string} collection
 * @param {string} docId
 * @returns {string}
 */
const docCacheKey = (collection, docId) =>
  `public-json:doc:${collection}:${docId}`;

/**
 * @param {string} collection
 * @param {string} docId
 * @returns {string}
 */
const docIlikeCacheKey = (collection, docId) =>
  `public-json:doc-ilike:${collection}:${String(docId).toLowerCase()}`;

/**
 * @param {string} collection
 * @returns {Promise<unknown[]>}
 */
const listPayloads = async (collection) => {
  return cacheGetOrSet(
    listCacheKey(collection),
    async () => {
      const rows = await getDb()
        .select({ payload: publicJsonDocs.payload })
        .from(publicJsonDocs)
        .where(eq(publicJsonDocs.collection, collection))
        // Numeric doc_ids sort as numbers; symbols (stocks) fall back to text order
        .orderBy(
          sql`(CASE WHEN ${publicJsonDocs.docId} ~ '^[0-9]+$' THEN (${publicJsonDocs.docId})::numeric ELSE NULL END)`,
          publicJsonDocs.docId
        );

      return rows.map((row) => row.payload);
    },
    PUBLIC_JSON_TTL_SECONDS
  );
};

/**
 * @param {string} collection
 * @param {string} docId
 * @returns {Promise<unknown | null>}
 */
const getPayloadByDocId = async (collection, docId) => {
  return cacheGetOrSet(
    docCacheKey(collection, String(docId)),
    async () => {
      const rows = await getDb()
        .select({ payload: publicJsonDocs.payload })
        .from(publicJsonDocs)
        .where(
          and(
            eq(publicJsonDocs.collection, collection),
            eq(publicJsonDocs.docId, String(docId))
          )
        )
        .limit(1);

      return rows[0]?.payload ?? null;
    },
    PUBLIC_JSON_TTL_SECONDS
  );
};

/**
 * Case-insensitive doc_id lookup (used for stock symbols).
 * @param {string} collection
 * @param {string} docId
 * @returns {Promise<unknown | null>}
 */
const getPayloadByDocIdIlike = async (collection, docId) => {
  return cacheGetOrSet(
    docIlikeCacheKey(collection, docId),
    async () => {
      const rows = await getDb()
        .select({ payload: publicJsonDocs.payload })
        .from(publicJsonDocs)
        .where(
          and(
            eq(publicJsonDocs.collection, collection),
            sql`lower(${publicJsonDocs.docId}) = lower(${String(docId)})`
          )
        )
        .limit(1);

      return rows[0]?.payload ?? null;
    },
    PUBLIC_JSON_TTL_SECONDS
  );
};

/**
 * @param {string} collection
 * @returns {Promise<unknown | null>}
 */
const getRandomPayload = async (collection) => {
  const rows = await getDb()
    .select({ payload: publicJsonDocs.payload })
    .from(publicJsonDocs)
    .where(eq(publicJsonDocs.collection, collection))
    .orderBy(sql`random()`)
    .limit(1);

  return rows[0]?.payload ?? null;
};

/**
 * Drop all cached public JSON payloads (call after re-seed).
 * @returns {Promise<number>}
 */
const invalidatePublicJsonCache = async () => cacheDelByPrefix("public-json:");

export {
  getPayloadByDocId,
  getPayloadByDocIdIlike,
  getRandomPayload,
  invalidatePublicJsonCache,
  listPayloads,
};
