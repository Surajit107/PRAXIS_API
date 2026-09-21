import { and, desc, eq, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { ChatEventEnum } from "@/constants.js";
import { dbInstance } from "@/db/index.js";
import { users } from "@/models/apps/auth/user.models.js";
import {
  chatParticipants,
  chats,
} from "@/models/apps/chat-app/chat.models.js";
import { chatMessages } from "@/models/apps/chat-app/message.models.js";
import { emitSocketEvent } from "@/socket/index.js";
import { ApiError } from "@/utils/ApiError.js";
import { ApiResponse } from "@/utils/ApiResponse.js";
import { asyncHandler } from "@/utils/asyncHandler.js";
import { removeLocalFile } from "@/utils/helpers.js";
import {
  getHydratedChatById,
  hydrateChats,
  loadAttachmentsByMessageIds,
  shapeAvailableUser,
} from "./hydrate.js";

const requireDb = () => {
  if (!dbInstance) {
    throw new ApiError(500, "Database is not connected");
  }
  return dbInstance;
};

/**
 * Remove attachment files from disk before chat CASCADE deletes rows.
 * @param {import("drizzle-orm/postgres-js").PostgresJsDatabase} db
 * @param {string} chatId
 */
const removeChatAttachmentFiles = async (db, chatId) => {
  const messages = await db
    .select({ id: chatMessages.id })
    .from(chatMessages)
    .where(eq(chatMessages.chat, chatId));

  const messageIds = messages.map((m) => m.id);
  if (!messageIds.length) return;

  const attachmentMap = await loadAttachmentsByMessageIds(db, messageIds);
  for (const list of attachmentMap.values()) {
    for (const attachment of list) {
      removeLocalFile(attachment.localPath);
    }
  }
};

/**
 * @param {import("drizzle-orm/postgres-js").PostgresJsDatabase} db
 * @param {string} chatId
 * @param {string} userId
 */
const isParticipant = async (db, chatId, userId) => {
  const [row] = await db
    .select({ chatId: chatParticipants.chatId })
    .from(chatParticipants)
    .where(
      and(
        eq(chatParticipants.chatId, chatId),
        eq(chatParticipants.userId, userId)
      )
    )
    .limit(1);
  return Boolean(row);
};

/**
 * Find an existing one-on-one chat that includes both users.
 * @param {import("drizzle-orm/postgres-js").PostgresJsDatabase} db
 * @param {string} userId
 * @param {string} receiverId
 */
const findOneOnOneChat = async (db, userId, receiverId) => {
  const p1 = alias(chatParticipants, "chat_p1");
  const p2 = alias(chatParticipants, "chat_p2");

  const [row] = await db
    .select({ chat: chats })
    .from(chats)
    .innerJoin(
      p1,
      and(eq(p1.chatId, chats.id), eq(p1.userId, userId))
    )
    .innerJoin(
      p2,
      and(eq(p2.chatId, chats.id), eq(p2.userId, receiverId))
    )
    .where(eq(chats.isGroupChat, false))
    .limit(1);

  return row?.chat ?? null;
};

const searchAvailableUsers = asyncHandler(async (req, res) => {
  const db = requireDb();

  const rows = await db
    .select()
    .from(users)
    .where(ne(users.id, req.user._id));

  const payload = rows.map(shapeAvailableUser).filter(Boolean);

  return res
    .status(200)
    .json(new ApiResponse(200, payload, "Users fetched successfully"));
});

const createOrGetAOneOnOneChat = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { receiverId } = req.params;

  const [receiver] = await db
    .select()
    .from(users)
    .where(eq(users.id, receiverId))
    .limit(1);

  if (!receiver) {
    throw new ApiError(404, "Receiver does not exist");
  }

  if (receiver.id === req.user._id) {
    throw new ApiError(400, "You cannot chat with yourself");
  }

  const existing = await findOneOnOneChat(db, req.user._id, receiverId);

  if (existing) {
    const [payload] = await hydrateChats(db, [existing]);
    return res
      .status(200)
      .json(new ApiResponse(200, payload, "Chat retrieved successfully"));
  }

  const created = await db.transaction(async (tx) => {
    const [newChat] = await tx
      .insert(chats)
      .values({
        name: "One on one chat",
        isGroupChat: false,
        admin: req.user._id,
      })
      .returning();

    await tx.insert(chatParticipants).values([
      { chatId: newChat.id, userId: req.user._id },
      { chatId: newChat.id, userId: receiverId },
    ]);

    return newChat;
  });

  const payload = await getHydratedChatById(db, created.id);

  if (!payload) {
    throw new ApiError(500, "Internal server error");
  }

  payload.participants?.forEach((participant) => {
    if (String(participant._id) === String(req.user._id)) return;
    emitSocketEvent(
      req,
      String(participant._id),
      ChatEventEnum.NEW_CHAT_EVENT,
      payload
    );
  });

  return res
    .status(201)
    .json(new ApiResponse(201, payload, "Chat retrieved successfully"));
});

const createAGroupChat = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { name, participants } = req.body;

  if (participants.includes(req.user._id.toString())) {
    throw new ApiError(
      400,
      "Participants array should not contain the group creator"
    );
  }

  const members = [...new Set([...participants, req.user._id.toString()])];

  if (members.length < 3) {
    throw new ApiError(
      400,
      "Seems like you have passed duplicate participants."
    );
  }

  const created = await db.transaction(async (tx) => {
    const [groupChat] = await tx
      .insert(chats)
      .values({
        name,
        isGroupChat: true,
        admin: req.user._id,
      })
      .returning();

    await tx.insert(chatParticipants).values(
      members.map((userId) => ({
        chatId: groupChat.id,
        userId,
      }))
    );

    return groupChat;
  });

  const payload = await getHydratedChatById(db, created.id);

  if (!payload) {
    throw new ApiError(500, "Internal server error");
  }

  payload.participants?.forEach((participant) => {
    if (String(participant._id) === String(req.user._id)) return;
    emitSocketEvent(
      req,
      String(participant._id),
      ChatEventEnum.NEW_CHAT_EVENT,
      payload
    );
  });

  return res
    .status(201)
    .json(new ApiResponse(201, payload, "Group chat created successfully"));
});

const getGroupChatDetails = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { chatId } = req.params;

  const [groupChat] = await db
    .select()
    .from(chats)
    .where(and(eq(chats.id, chatId), eq(chats.isGroupChat, true)))
    .limit(1);

  if (!groupChat) {
    throw new ApiError(404, "Group chat does not exist");
  }

  const [chat] = await hydrateChats(db, [groupChat]);

  return res
    .status(200)
    .json(new ApiResponse(200, chat, "Group chat fetched successfully"));
});

const renameGroupChat = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { chatId } = req.params;
  const { name } = req.body;

  const [groupChat] = await db
    .select()
    .from(chats)
    .where(and(eq(chats.id, chatId), eq(chats.isGroupChat, true)))
    .limit(1);

  if (!groupChat) {
    throw new ApiError(404, "Group chat does not exist");
  }

  if (String(groupChat.admin) !== String(req.user._id)) {
    throw new ApiError(404, "You are not an admin");
  }

  const [updated] = await db
    .update(chats)
    .set({ name })
    .where(eq(chats.id, chatId))
    .returning();

  const payload = await getHydratedChatById(db, updated.id);

  if (!payload) {
    throw new ApiError(500, "Internal server error");
  }

  payload.participants?.forEach((participant) => {
    emitSocketEvent(
      req,
      String(participant._id),
      ChatEventEnum.UPDATE_GROUP_NAME_EVENT,
      payload
    );
  });

  return res
    .status(200)
    .json(
      new ApiResponse(200, payload, "Group chat name updated successfully")
    );
});

const deleteGroupChat = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { chatId } = req.params;

  const [groupChat] = await db
    .select()
    .from(chats)
    .where(and(eq(chats.id, chatId), eq(chats.isGroupChat, true)))
    .limit(1);

  if (!groupChat) {
    throw new ApiError(404, "Group chat does not exist");
  }

  const [chat] = await hydrateChats(db, [groupChat]);

  if (String(chat.admin) !== String(req.user._id)) {
    throw new ApiError(404, "Only admin can delete the group");
  }

  await removeChatAttachmentFiles(db, chatId);
  await db.delete(chats).where(eq(chats.id, chatId));

  chat?.participants?.forEach((participant) => {
    if (String(participant._id) === String(req.user._id)) return;
    emitSocketEvent(
      req,
      String(participant._id),
      ChatEventEnum.LEAVE_CHAT_EVENT,
      chat
    );
  });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Group chat deleted successfully"));
});

const deleteOneOnOneChat = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { chatId } = req.params;

  const payload = await getHydratedChatById(db, chatId);

  if (!payload) {
    throw new ApiError(404, "Chat does not exist");
  }

  await removeChatAttachmentFiles(db, chatId);
  await db.delete(chats).where(eq(chats.id, chatId));

  const otherParticipant = payload?.participants?.find(
    (participant) => String(participant?._id) !== String(req.user._id)
  );

  if (otherParticipant?._id) {
    emitSocketEvent(
      req,
      String(otherParticipant._id),
      ChatEventEnum.LEAVE_CHAT_EVENT,
      payload
    );
  }

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Chat deleted successfully"));
});

const leaveGroupChat = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { chatId } = req.params;

  const [groupChat] = await db
    .select()
    .from(chats)
    .where(and(eq(chats.id, chatId), eq(chats.isGroupChat, true)))
    .limit(1);

  if (!groupChat) {
    throw new ApiError(404, "Group chat does not exist");
  }

  if (!(await isParticipant(db, chatId, req.user._id))) {
    throw new ApiError(400, "You are not a part of this group chat");
  }

  await db
    .delete(chatParticipants)
    .where(
      and(
        eq(chatParticipants.chatId, chatId),
        eq(chatParticipants.userId, req.user._id)
      )
    );

  const payload = await getHydratedChatById(db, chatId);

  if (!payload) {
    throw new ApiError(500, "Internal server error");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, payload, "Left a group successfully"));
});

const addNewParticipantInGroupChat = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { chatId, participantId } = req.params;

  const [groupChat] = await db
    .select()
    .from(chats)
    .where(and(eq(chats.id, chatId), eq(chats.isGroupChat, true)))
    .limit(1);

  if (!groupChat) {
    throw new ApiError(404, "Group chat does not exist");
  }

  if (String(groupChat.admin) !== String(req.user._id)) {
    throw new ApiError(404, "You are not an admin");
  }

  if (await isParticipant(db, chatId, participantId)) {
    throw new ApiError(409, "Participant already in a group chat");
  }

  await db.insert(chatParticipants).values({
    chatId,
    userId: participantId,
  });

  const payload = await getHydratedChatById(db, chatId);

  if (!payload) {
    throw new ApiError(500, "Internal server error");
  }

  emitSocketEvent(req, participantId, ChatEventEnum.NEW_CHAT_EVENT, payload);

  return res
    .status(200)
    .json(new ApiResponse(200, payload, "Participant added successfully"));
});

const removeParticipantFromGroupChat = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { chatId, participantId } = req.params;

  const [groupChat] = await db
    .select()
    .from(chats)
    .where(and(eq(chats.id, chatId), eq(chats.isGroupChat, true)))
    .limit(1);

  if (!groupChat) {
    throw new ApiError(404, "Group chat does not exist");
  }

  if (String(groupChat.admin) !== String(req.user._id)) {
    throw new ApiError(404, "You are not an admin");
  }

  if (!(await isParticipant(db, chatId, participantId))) {
    throw new ApiError(400, "Participant does not exist in the group chat");
  }

  await db
    .delete(chatParticipants)
    .where(
      and(
        eq(chatParticipants.chatId, chatId),
        eq(chatParticipants.userId, participantId)
      )
    );

  const payload = await getHydratedChatById(db, chatId);

  if (!payload) {
    throw new ApiError(500, "Internal server error");
  }

  emitSocketEvent(req, participantId, ChatEventEnum.LEAVE_CHAT_EVENT, payload);

  return res
    .status(200)
    .json(new ApiResponse(200, payload, "Participant removed successfully"));
});

const getAllChats = asyncHandler(async (req, res) => {
  const db = requireDb();

  const rows = await db
    .select({ chat: chats })
    .from(chats)
    .innerJoin(
      chatParticipants,
      and(
        eq(chatParticipants.chatId, chats.id),
        eq(chatParticipants.userId, req.user._id)
      )
    )
    .orderBy(desc(chats.updatedAt));

  const chatRows = rows.map((r) => r.chat);
  const hydrated = await hydrateChats(db, chatRows);

  return res
    .status(200)
    .json(
      new ApiResponse(200, hydrated || [], "User chats fetched successfully!")
    );
});

export {
  addNewParticipantInGroupChat,
  createAGroupChat,
  createOrGetAOneOnOneChat,
  deleteGroupChat,
  deleteOneOnOneChat,
  getAllChats,
  getGroupChatDetails,
  leaveGroupChat,
  removeParticipantFromGroupChat,
  renameGroupChat,
  searchAvailableUsers,
};
