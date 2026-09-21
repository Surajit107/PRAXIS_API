/**
 * Seeds public JSON datasets from `src/json/` into `public_json_docs`.
 *
 * Required before Postgres-backed public APIs return data:
 *   npm run db:seed:public
 *
 * YouTube is intentionally NOT seeded here (static file imports in
 * youtube.controllers.js). The YouTube HTTP mount remains disabled.
 */

import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { publicJsonDocs } from "@/models/public/public-json.models.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jsonDir = path.join(__dirname, "..", "json");

/** @type {ReadonlyArray<{ collection: string; file: string; docId: (item: Record<string, unknown>) => string }>} */
export const PUBLIC_JSON_COLLECTIONS = [
  {
    collection: "books",
    file: "books.json",
    docId: (item) => String(item.id),
  },
  {
    collection: "cats",
    file: "cats.json",
    docId: (item) => String(item.id),
  },
  {
    collection: "dogs",
    file: "dogs.json",
    docId: (item) => String(item.id),
  },
  {
    collection: "meals",
    file: "meals.json",
    docId: (item) => String(item.id),
  },
  {
    collection: "quotes",
    file: "quotes.json",
    docId: (item) => String(item.id),
  },
  {
    collection: "stocks",
    file: "nse-stocks.json",
    docId: (item) => String(item.Symbol),
  },
  {
    collection: "jokes",
    file: "randomjoke.json",
    docId: (item) => String(item.id),
  },
  {
    collection: "products",
    file: "randomproduct.json",
    docId: (item) => String(item.id),
  },
  {
    collection: "randomusers",
    file: "randomuser.json",
    docId: (item) => String(item.id),
  },
  {
    collection: "companies",
    file: "companies.json",
    docId: (item) => String(item.id),
  },
  {
    collection: "customers",
    file: "customers.json",
    docId: (item) => String(item.id),
  },
  {
    collection: "employees",
    file: "employees.json",
    docId: (item) => String(item.id),
  },
  {
    collection: "inventory",
    file: "inventory.json",
    docId: (item) => String(item.id),
  },
  {
    collection: "orders",
    file: "orders.json",
    docId: (item) => String(item.id),
  },
  {
    collection: "tickets",
    file: "support-ticket.json",
    docId: (item) => String(item.id),
  },
  {
    collection: "invoices",
    file: "invoices.json",
    docId: (item) => String(item.id),
  },
  {
    collection: "shipments",
    file: "shipments.json",
    docId: (item) => String(item.id),
  },
  {
    collection: "transactions",
    file: "transactions.json",
    docId: (item) => String(item.id),
  },
  {
    collection: "projects",
    file: "projects.json",
    docId: (item) => String(item.id),
  },
  {
    collection: "subscriptions",
    file: "subscriptions.json",
    docId: (item) => String(item.id),
  },
  {
    collection: "appointments",
    file: "appointments.json",
    docId: (item) => String(item.id),
  },
];

const BATCH_SIZE = 500;

/**
 * @param {import("drizzle-orm/postgres-js").PostgresJsDatabase} db
 * @param {typeof PUBLIC_JSON_COLLECTIONS[number]} def
 * @returns {Promise<number>}
 */
async function seedCollection(db, def) {
  const filePath = path.join(jsonDir, def.file);
  const raw = fs.readFileSync(filePath, "utf8");
  /** @type {Record<string, unknown>[]} */
  const items = JSON.parse(raw);

  if (!Array.isArray(items)) {
    throw new Error(`${def.file} must be a JSON array`);
  }

  await db
    .delete(publicJsonDocs)
    .where(eq(publicJsonDocs.collection, def.collection));

  const rows = items.map((item) => ({
    collection: def.collection,
    docId: def.docId(item),
    payload: item,
  }));

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await db.insert(publicJsonDocs).values(batch);
  }

  return rows.length;
}

/**
 * Replace all public_json collections from `src/json/` files.
 * @param {import("drizzle-orm/postgres-js").PostgresJsDatabase} db
 * @param {{ onCollection?: (collection: string, count: number) => void }} [options]
 * @returns {Promise<number>} total rows inserted
 */
export async function seedPublicJson(db, options = {}) {
  let total = 0;
  for (const def of PUBLIC_JSON_COLLECTIONS) {
    const count = await seedCollection(db, def);
    options.onCollection?.(def.collection, count);
    total += count;
  }
  return total;
}
