import { createRequire } from "module";
import { sql } from "drizzle-orm";
import { dbInstance } from "@/db/index.js";
import { ApiError } from "@/utils/ApiError.js";
import { ApiResponse } from "@/utils/ApiResponse.js";
import { asyncHandler } from "@/utils/asyncHandler.js";

const require = createRequire(import.meta.url);
const packageJson = require("../../package.json");

/**
 * Overall health — process is up.
 */
const healthcheck = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, "OK", "Health check passed"));
});

/**
 * Liveness — process is running; does not check dependencies.
 */
const live = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, { status: "alive" }, "Liveness check passed"));
});

/**
 * Readiness — process can serve traffic (DB reachable).
 */
const ready = asyncHandler(async (req, res) => {
  if (!dbInstance) {
    throw new ApiError(503, "Database not connected");
  }

  try {
    await dbInstance.execute(sql`select 1`);
  } catch {
    throw new ApiError(503, "Database unhealthy");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { status: "ready" }, "Readiness check passed"));
});

/**
 * Runtime / build metadata for ops and clients.
 */
const version = asyncHandler(async (req, res) => {
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        name: packageJson.name,
        version: packageJson.version,
        node: process.version,
        env: process.env.NODE_ENV || "development",
      },
      "Version info fetched successfully"
    )
  );
});

export { healthcheck, live, ready, version };
