import {
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "@/models/apps/auth/user.models.js";
import { categories } from "@/models/apps/ecommerce/category.models.js";

/** `Product` */
export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    category: uuid("category")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    description: text("description").notNull(),
    mainImageUrl: text("main_image_url").notNull(),
    mainImageLocalPath: text("main_image_local_path").notNull().default(""),
    name: text("name").notNull(),
    owner: uuid("owner").references(() => users.id, { onDelete: "set null" }),
    price: doublePrecision("price").notNull().default(0),
    stock: integer("stock").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("products_category_idx").on(table.category),
    index("products_owner_idx").on(table.owner),
  ]
);

/**
 * `Product.subImages[]` — child rows keep a UUID `_id` for remove-by-id.
 */
export const productSubImages = pgTable(
  "product_sub_images",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    localPath: text("local_path").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("product_sub_images_product_idx").on(table.productId)]
);

export const Product = products;
