import { eq, inArray } from "drizzle-orm";
import { users } from "@/models/apps/auth/user.models.js";
import {
  chatParticipants,
  chats,
} from "@/models/apps/chat-app/chat.models.js";
import {
  chatMessageAttachments,
  chatMessages,
} from "@/models/apps/chat-app/message.models.js";
import { shapeUser, withId } from "@/models/serializers.js";

/**
 * Slim sender projection for chat-message responses.
 * @param {typeof users.$inferSelect | null | undefined} user
 */
export const shapeChatSender = (user) => {
  const shaped = shapeUser(user);
  if (!shaped) return null;
  return {
    _id: shaped._id,
    avatar: shaped.avatar,
    email: shaped.email,
    username: shaped.username,
  };
};

/**
 * Available-user / search projection (`avatar`, `username`, `email`).
 * @param {typeof users.$inferSelect} user
 */
export const shapeAvailableUser = (user) => {
  const shaped = shapeUser(user);
  if (!shaped) return null;
  return {
    _id: shaped._id,
    avatar: shaped.avatar,
    username: shaped.username,
    email: shaped.email,
  };
};

/**
 * @param {typeof chatMessages.$inferSelect} message
 * @param {Array<{ id: string, url: string, localPath?: string }>} [attachments]
 * @param {ReturnType<typeof shapeChatSender> | string | null} [sender]
 */
export const shapeChatMessage = (message, attachments = [], sender = null) => {
  if (!message) return null;
  return {
    ...withId(message),
    sender,
    attachments: attachments.map((img) => ({
      _id: img.id,
      url: img.url,
      localPath: img.localPath ?? "",
    })),
  };
};

/**
 * @param {typeof chats.$inferSelect} chat
 * @param {ReturnType<typeof shapeUser>[]} participants
 * @param {ReturnType<typeof shapeChatMessage> | null} [lastMessage]
 */
export const shapeChat = (chat, participants = [], lastMessage = null) => {
  if (!chat) return null;
  return {
    ...withId(chat),
    participants,
    lastMessage,
  };
};

/**
 * @param {import("drizzle-orm/postgres-js").PostgresJsDatabase} db
 * @param {string[]} messageIds
 */
export const loadAttachmentsByMessageIds = async (db, messageIds) => {
  /** @type {Map<string, typeof chatMessageAttachments.$inferSelect[]>} */
  const map = new Map();
  if (!messageIds.length) return map;

  const rows = await db
    .select()
    .from(chatMessageAttachments)
    .where(inArray(chatMessageAttachments.messageId, messageIds));

  for (const row of rows) {
    const list = map.get(row.messageId) ?? [];
    list.push(row);
    map.set(row.messageId, list);
  }
  return map;
};

/**
 * Hydrate messages with slim sender + attachments.
 * @param {import("drizzle-orm/postgres-js").PostgresJsDatabase} db
 * @param {typeof chatMessages.$inferSelect[]} messages
 */
export const hydrateChatMessages = async (db, messages) => {
  if (!messages.length) return [];

  const messageIds = messages.map((m) => m.id);
  const senderIds = [
    ...new Set(messages.map((m) => m.sender).filter(Boolean)),
  ];

  const [attachmentMap, senderUsers] = await Promise.all([
    loadAttachmentsByMessageIds(db, messageIds),
    senderIds.length
      ? db.select().from(users).where(inArray(users.id, senderIds))
      : Promise.resolve([]),
  ]);

  const userById = new Map(senderUsers.map((u) => [u.id, u]));

  return messages.map((message) =>
    shapeChatMessage(
      message,
      attachmentMap.get(message.id) ?? [],
      message.sender ? shapeChatSender(userById.get(message.sender)) : null
    )
  );
};

/**
 * Load participant user rows keyed by chat id.
 * @param {import("drizzle-orm/postgres-js").PostgresJsDatabase} db
 * @param {string[]} chatIds
 */
export const loadParticipantUsersByChatIds = async (db, chatIds) => {
  /** @type {Map<string, ReturnType<typeof shapeUser>[]>} */
  const map = new Map();
  if (!chatIds.length) return map;

  const rows = await db
    .select({
      chatId: chatParticipants.chatId,
      user: users,
    })
    .from(chatParticipants)
    .innerJoin(users, eq(users.id, chatParticipants.userId))
    .where(inArray(chatParticipants.chatId, chatIds));

  for (const row of rows) {
    const list = map.get(row.chatId) ?? [];
    const shaped = shapeUser(row.user);
    if (shaped) list.push(shaped);
    map.set(row.chatId, list);
  }
  return map;
};

/**
 * Hydrate chats with participants + lastMessage (sender + attachments).
 * @param {import("drizzle-orm/postgres-js").PostgresJsDatabase} db
 * @param {typeof chats.$inferSelect[]} chatRows
 */
export const hydrateChats = async (db, chatRows) => {
  if (!chatRows.length) return [];

  const chatIds = chatRows.map((c) => c.id);
  const lastMessageIds = [
    ...new Set(chatRows.map((c) => c.lastMessage).filter(Boolean)),
  ];

  const [participantMap, lastMessageRows] = await Promise.all([
    loadParticipantUsersByChatIds(db, chatIds),
    lastMessageIds.length
      ? db
          .select()
          .from(chatMessages)
          .where(inArray(chatMessages.id, lastMessageIds))
      : Promise.resolve([]),
  ]);

  const hydratedLastMessages = await hydrateChatMessages(db, lastMessageRows);
  const lastMessageById = new Map(
    hydratedLastMessages.map((m) => [m._id, m])
  );

  return chatRows.map((chat) =>
    shapeChat(
      chat,
      participantMap.get(chat.id) ?? [],
      chat.lastMessage ? lastMessageById.get(chat.lastMessage) ?? null : null
    )
  );
};

/**
 * @param {import("drizzle-orm/postgres-js").PostgresJsDatabase} db
 * @param {string} chatId
 */
export const getHydratedChatById = async (db, chatId) => {
  const [chat] = await db
    .select()
    .from(chats)
    .where(eq(chats.id, chatId))
    .limit(1);

  if (!chat) return null;

  const [hydrated] = await hydrateChats(db, [chat]);
  return hydrated;
};
