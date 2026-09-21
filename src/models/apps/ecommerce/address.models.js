import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "@/models/apps/auth/user.models.js";

/** `Address` */
export const addresses = pgTable(
  "addresses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    addressLine1: text("address_line_1").notNull(),
    addressLine2: text("address_line_2"),
    city: text("city").notNull(),
    country: text("country").notNull(),
    owner: uuid("owner").references(() => users.id, { onDelete: "set null" }),
    pincode: text("pincode").notNull(),
    state: text("state").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [index("addresses_owner_idx").on(table.owner)]
);

export const Address = addresses;
