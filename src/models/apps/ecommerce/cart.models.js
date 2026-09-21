import {
  index,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "@/models/apps/auth/user.models.js";
import { coupons } from "@/models/apps/ecommerce/coupon.models.js";
import { products } from "@/models/apps/ecommerce/product.models.js";

/** `Cart` */
export const carts = pgTable(
  "carts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    owner: uuid("owner").references(() => users.id, { onDelete: "cascade" }),
    coupon: uuid("coupon").references(() => coupons.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    // 1:1 cart per user (controllers always `.limit(1)` by owner)
    uniqueIndex("carts_owner_uidx").on(table.owner),
    index("carts_coupon_idx").on(table.coupon),
  ]
);

/** `Cart.items[]` — each row has UUID `_id` like Mongo subdocs. */
export const cartItems = pgTable(
  "cart_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cartId: uuid("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("cart_items_cart_product_uidx").on(
      table.cartId,
      table.productId
    ),
    index("cart_items_product_idx").on(table.productId),
  ]
);

export const Cart = carts;
