import { index, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "@/models/apps/auth/user.models.js";
import { socialPosts } from "@/models/apps/social-media/post.models.js";

/** `SocialBookmark` */
export const socialBookmarks = pgTable(
  "social_bookmarks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    postId: uuid("post_id").references(() => socialPosts.id, {
      onDelete: "cascade",
    }),
    bookmarkedBy: uuid("bookmarked_by").references(() => users.id, {
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
    uniqueIndex("social_bookmarks_by_post_uidx").on(
      table.bookmarkedBy,
      table.postId
    ),
    index("social_bookmarks_post_idx").on(table.postId),
  ]
);

export const SocialBookmark = socialBookmarks;
