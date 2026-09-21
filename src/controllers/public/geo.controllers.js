import { and, count, eq, ilike } from "drizzle-orm";
import { dbInstance } from "@/db/index.js";
import {
  geoCities,
  geoCountries,
  geoStates,
} from "@/models/public/geo.models.js";
import { ApiError } from "@/utils/ApiError.js";
import { ApiResponse } from "@/utils/ApiResponse.js";
import { asyncHandler } from "@/utils/asyncHandler.js";
import { getPaginatedPayload } from "@/utils/helpers.js";

const requireDb = () => {
  if (!dbInstance) {
    throw new ApiError(500, "Database is not connected");
  }
  return dbInstance;
};

/**
 * @param {unknown} value
 * @param {number} fallback
 */
const toPositiveInt = (value, fallback) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.floor(n);
};

/**
 * Build the public-API paginate shape without loading the full table.
 * @param {unknown[]} pageRows
 * @param {number} totalItems
 * @param {number} page
 * @param {number} limit
 */
const paginateFromTotal = (pageRows, totalItems, page, limit) => {
  const empty = getPaginatedPayload([], page, limit);
  const totalPages = Math.ceil(totalItems / limit) || 0;
  return {
    ...empty,
    totalItems,
    totalPages,
    previousPage: page > 1,
    nextPage: page < totalPages,
    currentPageItems: pageRows.length,
    data: pageRows,
  };
};

/**
 * @param {Record<string, unknown>} row
 */
const shapeCountry = (row) => ({
  id: row.id,
  name: row.name,
  iso2: row.iso2,
  iso3: row.iso3,
  phonecode: row.phonecode,
  capital: row.capital,
  currency: row.currency,
  native: row.native,
  emoji: row.emoji,
  latitude: row.latitude,
  longitude: row.longitude,
});

/**
 * @param {Record<string, unknown>} row
 */
const shapeState = (row) => ({
  id: row.id,
  name: row.name,
  countryId: row.countryId,
  countryCode: row.countryCode,
  stateCode: row.stateCode,
  type: row.type,
  latitude: row.latitude,
  longitude: row.longitude,
});

/**
 * @param {Record<string, unknown>} row
 */
const shapeCity = (row) => ({
  id: row.id,
  name: row.name,
  stateId: row.stateId,
  countryId: row.countryId,
  countryCode: row.countryCode,
  latitude: row.latitude,
  longitude: row.longitude,
});

const listCountries = asyncHandler(async (req, res) => {
  const db = requireDb();
  const page = toPositiveInt(req.query.page, 1);
  const limit = toPositiveInt(req.query.limit, 10);
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

  const filters = q ? [ilike(geoCountries.name, `%${q}%`)] : [];
  const where = filters.length ? and(...filters) : undefined;

  const [totalRow] = await db
    .select({ value: count() })
    .from(geoCountries)
    .where(where);

  const totalItems = Number(totalRow?.value ?? 0);
  const rows = await db
    .select()
    .from(geoCountries)
    .where(where)
    .orderBy(geoCountries.name)
    .limit(limit)
    .offset((page - 1) * limit);

  return res.status(200).json(
    new ApiResponse(
      200,
      paginateFromTotal(rows.map(shapeCountry), totalItems, page, limit),
      "Countries fetched successfully"
    )
  );
});

const listStates = asyncHandler(async (req, res) => {
  const db = requireDb();
  const countryCode =
    typeof req.query.countryCode === "string"
      ? req.query.countryCode.trim().toUpperCase()
      : "";

  if (!countryCode) {
    throw new ApiError(400, "Query param countryCode is required");
  }

  const page = toPositiveInt(req.query.page, 1);
  const limit = toPositiveInt(req.query.limit, 10);
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

  const filters = [eq(geoStates.countryCode, countryCode)];
  if (q) filters.push(ilike(geoStates.name, `%${q}%`));
  const where = and(...filters);

  const [totalRow] = await db
    .select({ value: count() })
    .from(geoStates)
    .where(where);

  const totalItems = Number(totalRow?.value ?? 0);
  const rows = await db
    .select()
    .from(geoStates)
    .where(where)
    .orderBy(geoStates.name)
    .limit(limit)
    .offset((page - 1) * limit);

  return res.status(200).json(
    new ApiResponse(
      200,
      paginateFromTotal(rows.map(shapeState), totalItems, page, limit),
      "States fetched successfully"
    )
  );
});

const listCities = asyncHandler(async (req, res) => {
  const db = requireDb();
  const stateIdRaw =
    typeof req.query.stateId === "string" ? req.query.stateId.trim() : "";
  const stateId = Number(stateIdRaw);

  if (!stateIdRaw || !Number.isInteger(stateId) || stateId < 1) {
    throw new ApiError(400, "Query param stateId is required (positive integer)");
  }

  const page = toPositiveInt(req.query.page, 1);
  const limit = toPositiveInt(req.query.limit, 10);
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

  const filters = [eq(geoCities.stateId, stateId)];
  if (q) filters.push(ilike(geoCities.name, `%${q}%`));
  const where = and(...filters);

  const [totalRow] = await db
    .select({ value: count() })
    .from(geoCities)
    .where(where);

  const totalItems = Number(totalRow?.value ?? 0);
  const rows = await db
    .select()
    .from(geoCities)
    .where(where)
    .orderBy(geoCities.name)
    .limit(limit)
    .offset((page - 1) * limit);

  return res.status(200).json(
    new ApiResponse(
      200,
      paginateFromTotal(rows.map(shapeCity), totalItems, page, limit),
      "Cities fetched successfully"
    )
  );
});

export { listCountries, listStates, listCities };
