import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "@/models/apps/auth/user.models.js";

/** `EcomProfile` — created on user signup. */
export const ecomProfiles = pgTable(
  "ecom_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    firstName: text("first_name").notNull().default("John"),
    lastName: text("last_name").notNull().default("Doe"),
    countryCode: text("country_code").notNull().default(""),
    phoneNumber: text("phone_number").notNull().default(""),
    owner: uuid("owner").references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [uniqueIndex("ecom_profiles_owner_uidx").on(table.owner)]
);

export const EcomProfile = ecomProfiles;
