import logger from "@/logger/winston.logger.js";
import { ApiError } from "@/utils/ApiError.js";
import { removeUnusedMulterImageFilesOnError } from "@/utils/helpers.js";

/** Postgres SQLSTATE values that map to client/input errors (→ 400). */
const PG_CLIENT_ERROR_CODES = new Set([
  "22P02", // invalid_text_representation (e.g. bad UUID)
  "22001", // string_data_right_truncation
  "23502", // not_null_violation
  "23503", // foreign_key_violation
  "23505", // unique_violation
  "23514", // check_violation
]);

/**
 * Drizzle wraps `postgres` errors as `Error` with `cause` holding the real
 * PostgresError (`code` = SQLSTATE). Walk the chain; never trust top-level only.
 *
 * @param {unknown} error
 * @returns {string | undefined}
 */
const getPostgresErrorCode = (error) => {
  let current = error;
  while (current && typeof current === "object") {
    const code = /** @type {{ code?: unknown }} */ (current).code;
    if (typeof code === "string" && PG_CLIENT_ERROR_CODES.has(code)) {
      return code;
    }
    current = /** @type {{ cause?: unknown }} */ (current).cause;
  }
  return undefined;
};

/**
 * Prefer the underlying Postgres message over Drizzle's "Failed query: …" wrapper.
 *
 * @param {unknown} error
 * @returns {string | undefined}
 */
const getPostgresErrorMessage = (error) => {
  let current = error;
  while (current && typeof current === "object") {
    const code = /** @type {{ code?: unknown; message?: unknown }} */ (current)
      .code;
    const message = /** @type {{ message?: unknown }} */ (current).message;
    if (
      typeof code === "string" &&
      PG_CLIENT_ERROR_CODES.has(code) &&
      typeof message === "string" &&
      message.length > 0
    ) {
      return message;
    }
    current = /** @type {{ cause?: unknown }} */ (current).cause;
  }
  return undefined;
};

/**
 * @param {unknown} error
 * @returns {boolean}
 */
const isClientDatabaseError = (error) =>
  typeof getPostgresErrorCode(error) === "string";

/**
 *
 * @param {Error | ApiError} err
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 *
 *
 * @description This middleware is responsible to catch the errors from any request handler wrapped inside the {@link asyncHandler}
 */
const errorHandler = (err, req, res, next) => {
  let error = err;

  // Check if the error is an instance of an ApiError class which extends native Error class
  if (!(error instanceof ApiError)) {
    // if not
    // create a new ApiError instance to keep the consistency

    // assign an appropriate status code
    const statusCode =
      error.statusCode || (isClientDatabaseError(error) ? 400 : 500);

    // set a message from native Error instance or a custom one
    const message =
      getPostgresErrorMessage(error) ||
      error.message ||
      "Something went wrong";
    error = new ApiError(statusCode, message, error?.errors || [], err.stack);
  }

  // Explicit shape only — never leak Error.stack (or other Error internals) to clients
  const response = {
    statusCode: error.statusCode,
    data: error.data ?? null,
    success: false,
    errors: error.errors ?? [],
    message: error.message,
  };

  logger.error(error.stack || error.message);

  removeUnusedMulterImageFilesOnError(req);
  // Send error response
  return res.status(error.statusCode).json(response);
};

export { errorHandler };
