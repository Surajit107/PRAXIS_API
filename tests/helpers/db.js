import { sql } from "drizzle-orm";
import connectDB, { dbInstance, disconnectDB } from "@/db/index.js";

let connected = false;

/**
 * Connect once per Jest process (maxWorkers: 1).
 * Retries — Neon often flaps when reconnecting after each suite's closeTestDb().
 */
export async function ensureTestDb() {
  if (connected && dbInstance) return dbInstance;

  const maxAttempts = 5;
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await connectDB();
      connected = true;
      return dbInstance;
    } catch (error) {
      lastError = error;
      connected = false;
      try {
        await disconnectDB();
      } catch {
        /* ignore */
      }
      if (attempt === maxAttempts) break;
      await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
    }
  }

  throw lastError;
}

const TRUNCATE_SQL = `
  DO $$
  DECLARE
    stmt text;
  BEGIN
    SELECT 'TRUNCATE TABLE ' || string_agg(format('%I.%I', schemaname, tablename), ', ')
      || ' RESTART IDENTITY CASCADE'
    INTO stmt
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '__drizzle_migrations';

    IF stmt IS NOT NULL THEN
      EXECUTE stmt;
    END IF;
  END $$;
`;

/**
 * Wipe all public tables on the *test* DB only; keep schema + drizzle journal.
 * Refuses to run unless setup-env.js validated TEST_DATABASE_URL.
 */
export async function clearDb() {
  if (process.env.PRAXIS_API_ALLOW_DB_TRUNCATE !== "1") {
    throw new Error(
      "clearDb() blocked: PRAXIS_API_ALLOW_DB_TRUNCATE is not set. " +
        "Tests must load tests/setup-env.js with a dedicated TEST_DATABASE_URL."
    );
  }

  const db = await ensureTestDb();
  const maxAttempts = 5;

  // Clear aborted-tx state left by a prior failure (Neon / postgres.js).
  try {
    await db.execute(sql.raw("SELECT 1"));
  } catch (error) {
    const code = error?.cause?.code ?? error?.code;
    if (code === "25P02") {
      await db.execute(sql.raw("ROLLBACK"));
    } else {
      throw error;
    }
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await db.execute(sql.raw(TRUNCATE_SQL));
      return;
    } catch (error) {
      const code = error?.cause?.code ?? error?.code;
      const isDeadlock = code === "40P01";
      const isAborted = code === "25P02";
      if (isAborted) {
        try {
          await db.execute(sql.raw("ROLLBACK"));
        } catch {
          /* ignore */
        }
      }
      if ((!isDeadlock && !isAborted) || attempt === maxAttempts) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
    }
  }
}

export async function closeTestDb() {
  await disconnectDB();
  connected = false;
}
