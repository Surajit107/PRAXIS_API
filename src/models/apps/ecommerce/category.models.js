import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "@/models/apps/auth/user.models.js";

/** `Category` */
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    owner: uuid("owner").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [index("categories_owner_idx").on(table.owner)]
);

export const Category = categories;
