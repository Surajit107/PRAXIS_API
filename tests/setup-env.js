import dotenv from "dotenv";

dotenv.config({ path: "./.env", quiet: true });

/**
 * Normalize a Postgres URL for equality checks (ignore pooler host suffix +
 * query params; compare host + database name only).
 * @param {string} url
 */
function normalizeDbIdentity(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/-pooler\./i, ".").toLowerCase();
    const dbName = parsed.pathname.replace(/^\//, "").toLowerCase();
    return `${host}/${dbName}`;
  } catch {
    return url.trim().toLowerCase();
  }
}

const appDatabaseUrl = process.env.DATABASE_URL;
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

// HARD RULE: Jest never touches DATABASE_URL. A missing or identical
// TEST_DATABASE_URL previously wiped Neon / local app data (incl. public_json_docs).
if (!testDatabaseUrl) {
  throw new Error(
    "TEST_DATABASE_URL is required. Jest will not use DATABASE_URL. " +
      "Create a separate Postgres database (e.g. praxisapi_test or a Neon branch), " +
        "run migrations against it, then set TEST_DATABASE_URL in .env."
  );
}

if (
  appDatabaseUrl &&
  normalizeDbIdentity(testDatabaseUrl) === normalizeDbIdentity(appDatabaseUrl)
) {
  throw new Error(
    "TEST_DATABASE_URL must be a different database than DATABASE_URL. " +
      "Refusing to run tests that would TRUNCATE your app data."
  );
}

// Extra guard: DB name must look disposable. Stops the common mistake of
// pointing TEST_DATABASE_URL at local praxisapi while DATABASE_URL is Neon
// (different hosts → identity check passes → app data gets wiped).
try {
  const testDbName = new URL(testDatabaseUrl).pathname
    .replace(/^\//, "")
    .toLowerCase();
  if (!testDbName.includes("test")) {
    throw new Error(
      `TEST_DATABASE_URL database name "${testDbName}" must contain "test" ` +
        `(e.g. praxisapi_test). Jest TRUNCATES this DB — do not use your app DB.`
    );
  }
} catch (error) {
  if (error instanceof TypeError) {
    throw new Error(`Invalid TEST_DATABASE_URL: ${testDatabaseUrl}`);
  }
  throw error;
}

process.env.DATABASE_URL = testDatabaseUrl;
// Allow clearDb() only after this guard has passed.
process.env.PRAXIS_API_ALLOW_DB_TRUNCATE = "1";

// Neon transaction-mode pooler breaks multi-statement transactions / TRUNCATE
// reliability under Jest. Prefer the direct endpoint for tests.
if (
  process.env.DATABASE_URL &&
  process.env.DATABASE_URL.includes("-pooler.") &&
  !process.env.TEST_USE_POOLER
) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace(
    "-pooler.",
    "."
  );
}

// Jest defaults NODE_ENV=test; avoidInProduction only allows "development".
// Seed/reset-db suites must run under development (production-guards toggles temporarily).
process.env.NODE_ENV = "development";

// Avoid hitting Resend during register/forgot-password tests
process.env.RESEND_API_KEY = "";
process.env.RESEND_FROM_EMAIL = "";

const required = [
  "DATABASE_URL",
  "ACCESS_TOKEN_SECRET",
  "REFRESH_TOKEN_SECRET",
  "ACCESS_TOKEN_EXPIRY",
  "REFRESH_TOKEN_EXPIRY",
  "EXPRESS_SESSION_SECRET",
];

const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(
    `Missing required test env vars: ${missing.join(", ")}. ` +
      "Copy .env.example → .env and set TEST_DATABASE_URL to a dedicated test DB."
  );
}
