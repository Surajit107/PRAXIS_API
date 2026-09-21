import { and, eq, sql } from "drizzle-orm";
import { dbInstance } from "@/db/index.js";
import { publicJsonDocs } from "@/models/public/public-json.models.js";

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
 * @returns {Promise<unknown[]>}
 */
const listPayloads = async (collection) => {
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
};

/**
 * @param {string} collection
 * @param {string} docId
 * @returns {Promise<unknown | null>}
 */
const getPayloadByDocId = async (collection, docId) => {
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
};

/**
 * Case-insensitive doc_id lookup (used for stock symbols).
 * @param {string} collection
 * @param {string} docId
 * @returns {Promise<unknown | null>}
 */
const getPayloadByDocIdIlike = async (collection, docId) => {
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

export {
  getPayloadByDocId,
  getPayloadByDocIdIlike,
  getRandomPayload,
  listPayloads,
};
