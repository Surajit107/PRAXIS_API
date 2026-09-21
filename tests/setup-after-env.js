/**
 * Intentionally empty.
 *
 * Do NOT close the Postgres pool after each suite. `setupFilesAfterEnv`
 * hooks run per file; reconnecting to Neon on every suite exhausts the
 * free-tier connection budget and flakes the full `npm test` run.
 *
 * The pool is left open for the Jest process lifetime; `forceExit: true`
 * in jest.config.js tears the process down.
 */
