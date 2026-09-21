import { index, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "@/models/apps/auth/user.models.js";

/** `SocialFollow` */
export const socialFollows = pgTable(
  "social_follows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    followerId: uuid("follower_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    followeeId: uuid("followee_id").references(() => users.id, {
      onDelete: "cascade",
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
    uniqueIndex("social_follows_follower_followee_uidx").on(
      table.followerId,
      table.followeeId
    ),
    // Reverse lookup: "who follows me" (left prefix of unique covers followerId)
    index("social_follows_followee_idx").on(table.followeeId),
  ]
);

export const SocialFollow = socialFollows;
