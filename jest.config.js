/** @type {import("jest").Config} */
const config = {
  testEnvironment: "node",
  // Native ESM — no Babel transform
  transform: {},
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  setupFiles: ["<rootDir>/tests/setup-env.js"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup-after-env.js"],
  testMatch: ["<rootDir>/tests/**/*.test.js"],
  // Single worker: shared Postgres; parallel suites would race on truncate
  maxWorkers: 1,
  testTimeout: 30_000,
  verbose: true,
  clearMocks: true,
  // Safety net if any handle remains (session store / passport / timers)
  forceExit: true,
};

export default config;
