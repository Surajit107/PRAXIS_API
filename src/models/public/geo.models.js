import {
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * World geo hierarchy for public cascading APIs (country → state → city).
 * IDs align with countries-states-cities-database so seeds stay stable.
 */

/** `GeoCountry` */
export const geoCountries = pgTable(
  "geo_countries",
  {
    id: integer("id").primaryKey(),
    name: text("name").notNull(),
    iso2: text("iso2").notNull(),
    iso3: text("iso3"),
    phonecode: text("phonecode"),
    capital: text("capital"),
    currency: text("currency"),
    native: text("native"),
    emoji: text("emoji"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
  },
  (table) => [
    uniqueIndex("geo_countries_iso2_uidx").on(table.iso2),
    index("geo_countries_name_idx").on(table.name),
  ]
);

/** `GeoState` */
export const geoStates = pgTable(
  "geo_states",
  {
    id: integer("id").primaryKey(),
    name: text("name").notNull(),
    countryId: integer("country_id")
      .notNull()
      .references(() => geoCountries.id, { onDelete: "cascade" }),
    countryCode: text("country_code").notNull(),
    stateCode: text("state_code"),
    type: text("type"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
  },
  (table) => [
    index("geo_states_country_code_idx").on(table.countryCode),
    index("geo_states_country_code_name_idx").on(table.countryCode, table.name),
  ]
);

/** `GeoCity` */
export const geoCities = pgTable(
  "geo_cities",
  {
    id: integer("id").primaryKey(),
    name: text("name").notNull(),
    stateId: integer("state_id")
      .notNull()
      .references(() => geoStates.id, { onDelete: "cascade" }),
    countryId: integer("country_id")
      .notNull()
      .references(() => geoCountries.id, { onDelete: "cascade" }),
    countryCode: text("country_code").notNull(),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
  },
  (table) => [
    index("geo_cities_state_id_idx").on(table.stateId),
    index("geo_cities_state_id_name_idx").on(table.stateId, table.name),
  ]
);

export const GeoCountry = geoCountries;
export const GeoState = geoStates;
export const GeoCity = geoCities;
