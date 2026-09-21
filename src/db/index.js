import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import logger from "@/logger/winston.logger.js";
import * as schema from "@/models/index.js";

/** @type {import("drizzle-orm/postgres-js").PostgresJsDatabase<typeof schema> | undefined} */
export let dbInstance = undefined;

/** @type {ReturnType<typeof postgres> | undefined} */
let sqlClient = undefined;

/**
 * Neon (and most managed Postgres) require TLS. Local Docker does not.
 * @param {string} databaseUrl
 */
const isRemotePostgresUrl = (databaseUrl) => {
  try {
    const host = new URL(databaseUrl).hostname.toLowerCase();
    return host !== "localhost" && host !== "127.0.0.1" && host !== "::1";
  } catch {
    return false;
  }
};

const connectDB = async () => {
  try {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error("DATABASE_URL is not set");
    }

    const isJest = typeof process.env.JEST_WORKER_ID !== "undefined";
    const isRemote = isRemotePostgresUrl(databaseUrl);

    sqlClient = postgres(databaseUrl, {
      // Jest + Neon pooler: multiple clients + TRUNCATE → deadlocks.
      max: isJest ? 1 : 10,
      // Neon transaction pooler does not support prepared statements.
      prepare: false,
      idle_timeout: 20,
      connect_timeout: 30,
      // Neon requires TLS; explicit ssl helps on some Node/OpenSSL builds.
      ...(isRemote ? { ssl: "require" } : {}),
    });
    dbInstance = drizzle(sqlClient, { schema });

    // Force a round-trip so boot fails fast if Postgres is down
    await sqlClient`select 1`;

    logger.info(`\n☘️  PostgreSQL Connected!\n`);
  } catch (error) {
    logger.error("PostgreSQL connection error: ", error);
    // Jest reconnects between suites (setup-after-env closes the pool). Never
    // process.exit under tests — that kills the whole run on a transient Neon blip.
    if (typeof process.env.JEST_WORKER_ID !== "undefined") {
      sqlClient = undefined;
      dbInstance = undefined;
      throw error;
    }
    process.exit(1);
  }
};

/**
 * Close the Postgres pool (required for Jest to exit cleanly).
 */
export const disconnectDB = async () => {
  if (sqlClient) {
    await sqlClient.end({ timeout: 5 });
    sqlClient = undefined;
    dbInstance = undefined;
  }
};

export { schema };
export default connectDB;
