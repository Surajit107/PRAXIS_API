import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "@/models/apps/auth/user.models.js";

/** `SocialPost` */
export const socialPosts = pgTable(
  "social_posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    content: text("content").notNull(),
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
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
    index("social_posts_author_idx").on(table.author),
    // getPostsByTag: arrayContains / `@>` needs GIN
    index("social_posts_tags_gin_idx").using("gin", table.tags),
  ]
);

/** `SocialPost.images[]` */
export const socialPostImages = pgTable(
  "social_post_images",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    postId: uuid("post_id")
      .notNull()
      .references(() => socialPosts.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    localPath: text("local_path").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("social_post_images_post_idx").on(table.postId)]
);

export const SocialPost = socialPosts;
