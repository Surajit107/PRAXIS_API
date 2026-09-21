import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "@/models/apps/auth/user.models.js";
import { chats } from "@/models/apps/chat-app/chat.models.js";

/** `ChatMessage` */
export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sender: uuid("sender").references(() => users.id, { onDelete: "set null" }),
    content: text("content"),
    chat: uuid("chat")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    // List messages: filter by chat + order by createdAt DESC
    index("chat_messages_chat_created_at_idx").on(table.chat, table.createdAt),
    index("chat_messages_sender_idx").on(table.sender),
  ]
);

/** `ChatMessage.attachments[]` */
export const chatMessageAttachments = pgTable(
  "chat_message_attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => chatMessages.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    localPath: text("local_path").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("chat_message_attachments_message_idx").on(table.messageId)]
);

export const ChatMessage = chatMessages;
