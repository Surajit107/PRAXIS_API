import {
  boolean,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "@/models/apps/auth/user.models.js";

/**
 * `Chat`.
 * `lastMessage` is a nullable UUID without a DB FK to avoid circular
 * chat ↔ chat_messages dependency at migrate time; app layer keeps it coherent.
 */
export const chats = pgTable(
  "chats",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    isGroupChat: boolean("is_group_chat").notNull().default(false),
    lastMessage: uuid("last_message"),
    admin: uuid("admin").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [index("chats_admin_idx").on(table.admin)]
);

/** `Chat.participants[]` */
export const chatParticipants = pgTable(
  "chat_participants",
  {
    chatId: uuid("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.chatId, table.userId] }),
    index("chat_participants_user_idx").on(table.userId),
  ]
);

export const Chat = chats;
