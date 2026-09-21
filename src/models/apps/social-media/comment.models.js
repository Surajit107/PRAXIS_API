import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "@/models/apps/auth/user.models.js";
import { socialPosts } from "@/models/apps/social-media/post.models.js";

/** `SocialComment` */
export const socialComments = pgTable(
  "social_comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    content: text("content").notNull(),
    postId: uuid("post_id").references(() => socialPosts.id, {
      onDelete: "cascade",
    }),
    author: uuid("author").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("social_comments_post_idx").on(table.postId),
    index("social_comments_author_idx").on(table.author),
  ]
);

export const SocialComment = socialComments;
