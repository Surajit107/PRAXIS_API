import { jsonb, pgTable, primaryKey, text } from "drizzle-orm/pg-core";

/**
 * Static public-API datasets seeded from `src/json/*` (JSONB documents).
 * Postgres-only storage for public JSON datasets.
 */
export const publicJsonDocs = pgTable(
  "public_json_docs",
  {
    collection: text("collection").notNull(),
    docId: text("doc_id").notNull(),
    payload: jsonb("payload").notNull(),
  },
  (table) => [
    // PK left prefix already covers collection-only scans
    primaryKey({ columns: [table.collection, table.docId] }),
  ]
);

export const PublicJsonDoc = publicJsonDocs;
