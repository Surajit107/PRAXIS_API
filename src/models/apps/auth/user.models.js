import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { UserLoginType, UserRolesEnum } from "@/constants.js";
import { userLoginTypeEnum, userRoleEnum } from "@/models/enums.js";

/**
 * `User` — UUID PK exposed as `_id` in API responses.
 * Avatar flattened to url/localPath columns; assemble via serializers.
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    avatarUrl: text("avatar_url")
      .notNull()
      .default("https://via.placeholder.com/200x200.png"),
    avatarLocalPath: text("avatar_local_path").notNull().default(""),
    username: text("username").notNull(),
    email: text("email").notNull(),
    role: userRoleEnum("role").notNull().default(UserRolesEnum.USER),
    password: text("password").notNull(),
    loginType: userLoginTypeEnum("login_type")
      .notNull()
      .default(UserLoginType.EMAIL_PASSWORD),
    isEmailVerified: boolean("is_email_verified").notNull().default(false),
    refreshToken: text("refresh_token"),
    forgotPasswordToken: text("forgot_password_token"),
    forgotPasswordExpiry: timestamp("forgot_password_expiry", {
      withTimezone: true,
    }),
    emailVerificationToken: text("email_verification_token"),
    emailVerificationExpiry: timestamp("email_verification_expiry", {
      withTimezone: true,
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
    uniqueIndex("users_username_uidx").on(table.username),
    uniqueIndex("users_email_uidx").on(table.email),
    // Token lookups on verify/reset (hashed token equality)
    index("users_email_verification_token_idx").on(table.emailVerificationToken),
    index("users_forgot_password_token_idx").on(table.forgotPasswordToken),
  ]
);

/** Legacy export name. */
export const User = users;
