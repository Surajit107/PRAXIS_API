import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "@/models/apps/auth/user.models.js";

/** `SocialProfile` — created on user signup. */
export const socialProfiles = pgTable(
  "social_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    coverImageUrl: text("cover_image_url")
      .notNull()
      .default("https://via.placeholder.com/800x450.png"),
    coverImageLocalPath: text("cover_image_local_path").notNull().default(""),
    firstName: text("first_name").notNull().default("John"),
    lastName: text("last_name").notNull().default("Doe"),
    bio: text("bio").notNull().default(""),
    dob: timestamp("dob", { withTimezone: true }),
    location: text("location").notNull().default(""),
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
  (table) => [uniqueIndex("social_profiles_owner_uidx").on(table.owner)]
);

export const SocialProfile = socialProfiles;
