import {
  boolean,
  doublePrecision,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { CouponTypeEnum } from "@/constants.js";
import { couponTypeEnum } from "@/models/enums.js";
import { users } from "@/models/apps/auth/user.models.js";

/** `Coupon` */
export const coupons = pgTable(
  "coupons",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    couponCode: text("coupon_code").notNull(),
    type: couponTypeEnum("type").notNull().default(CouponTypeEnum.FLAT),
    discountValue: doublePrecision("discount_value").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    minimumCartValue: doublePrecision("minimum_cart_value").notNull().default(0),
    startDate: timestamp("start_date", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiryDate: timestamp("expiry_date", { withTimezone: true }),
    owner: uuid("owner").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("coupons_coupon_code_uidx").on(table.couponCode),
    index("coupons_owner_idx").on(table.owner),
  ]
);

export const Coupon = coupons;
