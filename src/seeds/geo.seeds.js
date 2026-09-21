/**
 * Seeds geo_countries / geo_states / geo_cities.
 *
 * World dump (default for CLI):
 *   npm run db:seed:geo
 * Downloads CSC nested JSON.gz into data/geo-cache/ (gitignored), then replaces tables.
 *
 * Fixture (tests / offline):
 *   seedGeo(db, { source: "fixture" })
 *   npm run db:seed:geo -- --fixture
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import zlib from "zlib";
import {
  geoCities,
  geoCountries,
  geoStates,
} from "@/models/public/geo.models.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.join(__dirname, "fixtures", "geo");
const CACHE_DIR = path.join(__dirname, "..", "..", "data", "geo-cache");

/**
 * Pinned CSC release — standalone cities.json was removed from master/json/.
 * Nested dump: ~250 countries, ~5.3k states, ~153k cities.
 */
const CSC_RELEASE = "v3.2-export.7";
const CSC_NESTED_GZ =
  `https://github.com/dr5hn/countries-states-cities-database/releases/download/${CSC_RELEASE}/json-countries%2Bstates%2Bcities.json.gz`;
const CACHE_FILE = "countries+states+cities.json.gz";

const BATCH_SIZE = 1000;

/**
 * @param {unknown} value
 * @returns {number | null}
 */
const toCoord = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/**
 * @param {string} dir
 * @param {string} file
 * @returns {Record<string, unknown>[]}
 */
const readJsonArray = (dir, file) => {
  const raw = fs.readFileSync(path.join(dir, file), "utf8");
  const items = JSON.parse(raw);
  if (!Array.isArray(items)) {
    throw new Error(`${file} must be a JSON array`);
  }
  return items;
};

/**
 * @returns {Promise<void>}
 */
const ensureWorldCache = async () => {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const dest = path.join(CACHE_DIR, CACHE_FILE);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
    return;
  }

  const res = await fetch(CSC_NESTED_GZ, {
    redirect: "follow",
    headers: { "User-Agent": "praxis-api-geo-seed" },
  });
  if (!res.ok) {
    throw new Error(
      `Failed to download ${CSC_NESTED_GZ}: ${res.status} ${res.statusText}`
    );
  }

  const body = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, body);
};

/**
 * Flatten CSC nested countries→states→cities into row arrays.
 * @param {Record<string, unknown>[]} nested
 */
const flattenNestedWorld = (nested) => {
  /** @type {ReturnType<typeof mapCountry>[]} */
  const countries = [];
  /** @type {ReturnType<typeof mapState>[]} */
  const states = [];
  /** @type {ReturnType<typeof mapCity>[]} */
  const cities = [];

  for (const country of nested) {
    const countryId = Number(country.id);
    const countryCode = String(country.iso2).toUpperCase();
    countries.push(mapCountry(country));

    const stateList = Array.isArray(country.states) ? country.states : [];
    for (const state of stateList) {
      const stateId = Number(state.id);
      states.push(mapState(state, countryId, countryCode));

      const cityList = Array.isArray(state.cities) ? state.cities : [];
      for (const city of cityList) {
        cities.push(mapCity(city, stateId, countryId, countryCode));
      }
    }
  }

  return { countries, states, cities };
};

/**
 * @param {Record<string, unknown>} c
 */
const mapCountry = (c) => ({
  id: Number(c.id),
  name: String(c.name),
  iso2: String(c.iso2).toUpperCase(),
  iso3: c.iso3 != null ? String(c.iso3) : null,
  phonecode: c.phonecode != null ? String(c.phonecode) : null,
  capital: c.capital != null ? String(c.capital) : null,
  currency: c.currency != null ? String(c.currency) : null,
  native: c.native != null ? String(c.native) : null,
  emoji: c.emoji != null ? String(c.emoji) : null,
  latitude: toCoord(c.latitude),
  longitude: toCoord(c.longitude),
});

/**
 * @param {Record<string, unknown>} s
 * @param {number} countryId
 * @param {string} countryCode
 */
const mapState = (s, countryId, countryCode) => ({
  id: Number(s.id),
  name: String(s.name),
  countryId,
  countryCode,
  // Nested dump uses `iso2` for state code; flat fixture uses `state_code`
  stateCode:
    s.state_code != null
      ? String(s.state_code)
      : s.iso2 != null
        ? String(s.iso2)
        : null,
  type: s.type != null ? String(s.type) : null,
  latitude: toCoord(s.latitude),
  longitude: toCoord(s.longitude),
});

/**
 * @param {Record<string, unknown>} c
 * @param {number} stateId
 * @param {number} countryId
 * @param {string} countryCode
 */
const mapCity = (c, stateId, countryId, countryCode) => ({
  id: Number(c.id),
  name: String(c.name),
  stateId: c.state_id != null ? Number(c.state_id) : stateId,
  countryId: c.country_id != null ? Number(c.country_id) : countryId,
  countryCode:
    c.country_code != null
      ? String(c.country_code).toUpperCase()
      : countryCode,
  latitude: toCoord(c.latitude),
  longitude: toCoord(c.longitude),
});

/**
 * @param {"fixture" | "world"} source
 */
const loadSource = async (source) => {
  if (source === "fixture") {
    const countries = readJsonArray(FIXTURE_DIR, "countries.json").map(
      mapCountry
    );
    const countryIds = new Set(countries.map((c) => c.id));
    const states = readJsonArray(FIXTURE_DIR, "states.json")
      .filter((s) => countryIds.has(Number(s.country_id)))
      .map((s) =>
        mapState(s, Number(s.country_id), String(s.country_code).toUpperCase())
      );
    const stateIds = new Set(states.map((s) => s.id));
    const cities = readJsonArray(FIXTURE_DIR, "cities.json")
      .filter(
        (c) =>
          stateIds.has(Number(c.state_id)) &&
          countryIds.has(Number(c.country_id))
      )
      .map((c) =>
        mapCity(
          c,
          Number(c.state_id),
          Number(c.country_id),
          String(c.country_code).toUpperCase()
        )
      );
    return { countries, states, cities };
  }

  await ensureWorldCache();
  const gz = fs.readFileSync(path.join(CACHE_DIR, CACHE_FILE));
  const nested = JSON.parse(zlib.gunzipSync(gz).toString("utf8"));
  if (!Array.isArray(nested)) {
    throw new Error("World geo dump must be a JSON array of countries");
  }
  return flattenNestedWorld(nested);
};

/**
 * @template T
 * @param {import("drizzle-orm/postgres-js").PostgresJsDatabase} db
 * @param {import("drizzle-orm/pg-core").PgTable} table
 * @param {T[]} rows
 */
const insertBatches = async (db, table, rows) => {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await db.insert(table).values(batch);
  }
};

/**
 * Replace all geo tables from fixture or world CSC dump.
 *
 * @param {import("drizzle-orm/postgres-js").PostgresJsDatabase} db
 * @param {{
 *   source?: "fixture" | "world";
 *   onPhase?: (phase: string, count: number) => void;
 * }} [options]
 * @returns {Promise<{ countries: number; states: number; cities: number }>}
 */
export async function seedGeo(db, options = {}) {
  const source = options.source ?? "world";
  const { countries, states, cities } = await loadSource(source);

  await db.delete(geoCities);
  await db.delete(geoStates);
  await db.delete(geoCountries);

  await insertBatches(db, geoCountries, countries);
  options.onPhase?.("countries", countries.length);

  await insertBatches(db, geoStates, states);
  options.onPhase?.("states", states.length);

  await insertBatches(db, geoCities, cities);
  options.onPhase?.("cities", cities.length);

  return {
    countries: countries.length,
    states: states.length,
    cities: cities.length,
  };
}
