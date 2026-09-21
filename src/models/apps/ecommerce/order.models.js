import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import {
  OrderStatusEnum,
  PaymentProviderEnum,
} from "@/constants.js";
import { orderStatusEnum, paymentProviderEnum } from "@/models/enums.js";
import { users } from "@/models/apps/auth/user.models.js";
import { coupons } from "@/models/apps/ecommerce/coupon.models.js";
import { products } from "@/models/apps/ecommerce/product.models.js";

/**
 * `EcomOrder`.
 * Address is a denormalized snapshot (not an Address FK) — flattened columns.
 */
export const ecomOrders = pgTable(
  "ecom_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderPrice: doublePrecision("order_price").notNull(),
    discountedOrderPrice: doublePrecision("discounted_order_price").notNull(),
    coupon: uuid("coupon").references(() => coupons.id, {
      onDelete: "set null",
    }),
    customer: uuid("customer").references(() => users.id, {
      onDelete: "set null",
    }),
    addressLine1: text("address_line_1").notNull(),
    addressLine2: text("address_line_2"),
    city: text("city").notNull(),
    country: text("country").notNull(),
    pincode: text("pincode").notNull(),
    state: text("state").notNull(),
    status: orderStatusEnum("status").notNull().default(OrderStatusEnum.PENDING),
    paymentProvider: paymentProviderEnum("payment_provider")
      .notNull()
      .default(PaymentProviderEnum.UNKNOWN),
    paymentId: text("payment_id"),
    isPaymentDone: boolean("is_payment_done").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("ecom_orders_customer_idx").on(table.customer),
    index("ecom_orders_status_idx").on(table.status),
    // Payment verify paths: eq(paymentId) / paymentId + isPaymentDone
    index("ecom_orders_payment_id_idx").on(table.paymentId),
    index("ecom_orders_coupon_idx").on(table.coupon),
  ]
);

/** `EcomOrder.items[]` */
export const ecomOrderItems = pgTable(
  "ecom_order_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => ecomOrders.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ecom_order_items_order_idx").on(table.orderId),
    index("ecom_order_items_product_idx").on(table.productId),
  ]
);

export const EcomOrder = ecomOrders;
