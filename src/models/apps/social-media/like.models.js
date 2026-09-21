import { sql } from "drizzle-orm";
import { index, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "@/models/apps/auth/user.models.js";
import { socialComments } from "@/models/apps/social-media/comment.models.js";
import { socialPosts } from "@/models/apps/social-media/post.models.js";

/**
 * `SocialLike` — polymorphic: either postId or commentId is set.
 */
export const socialLikes = pgTable(
  "social_likes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    postId: uuid("post_id").references(() => socialPosts.id, {
      onDelete: "cascade",
    }),
    commentId: uuid("comment_id").references(() => socialComments.id, {
      onDelete: "cascade",
    }),
    likedBy: uuid("liked_by").references(() => users.id, {
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
    index("social_likes_post_idx").on(table.postId),
    index("social_likes_comment_idx").on(table.commentId),
    index("social_likes_liked_by_idx").on(table.likedBy),
    // Toggle/hydrate predicates: (post|comment, likedBy) — partial so nulls don't collide
    uniqueIndex("social_likes_post_liked_by_uidx")
      .on(table.postId, table.likedBy)
      .where(sql`${table.postId} is not null`),
    uniqueIndex("social_likes_comment_liked_by_uidx")
      .on(table.commentId, table.likedBy)
      .where(sql`${table.commentId} is not null`),
  ]
);

export const SocialLike = socialLikes;
