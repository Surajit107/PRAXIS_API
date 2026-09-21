import { pgEnum } from "drizzle-orm/pg-core";
import {
  CouponTypeEnum,
  OrderStatusEnum,
  PaymentProviderEnum,
  UserLoginType,
  UserRolesEnum,
} from "@/constants.js";

/** Drizzle Postgres enums (values owned by `src/constants.js`). */

export const userRoleEnum = pgEnum(
  "user_role",
  /** @type {[string, ...string[]]} */ (Object.values(UserRolesEnum))
);

export const userLoginTypeEnum = pgEnum(
  "user_login_type",
  /** @type {[string, ...string[]]} */ (Object.values(UserLoginType))
);

export const orderStatusEnum = pgEnum(
  "order_status",
  /** @type {[string, ...string[]]} */ (Object.values(OrderStatusEnum))
);

export const paymentProviderEnum = pgEnum(
  "payment_provider",
  /** @type {[string, ...string[]]} */ (Object.values(PaymentProviderEnum))
);

export const couponTypeEnum = pgEnum(
  "coupon_type",
  /** @type {[string, ...string[]]} */ (Object.values(CouponTypeEnum))
);
