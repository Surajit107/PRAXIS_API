import { and, desc, eq } from "drizzle-orm";
import { ChatEventEnum } from "@/constants.js";
import { dbInstance } from "@/db/index.js";
import {
  chatParticipants,
  chats,
} from "@/models/apps/chat-app/chat.models.js";
import {
  chatMessageAttachments,
  chatMessages,
} from "@/models/apps/chat-app/message.models.js";
import { emitSocketEvent } from "@/socket/index.js";
import { ApiError } from "@/utils/ApiError.js";
import { ApiResponse } from "@/utils/ApiResponse.js";
import { asyncHandler } from "@/utils/asyncHandler.js";
import {
  getLocalPath,
  getStaticFilePath,
  removeLocalFile,
} from "@/utils/helpers.js";
import {
  hydrateChatMessages,
  loadAttachmentsByMessageIds,
  shapeChatMessage,
} from "./hydrate.js";

const requireDb = () => {
  if (!dbInstance) {
    throw new ApiError(500, "Database is not connected");
  }
  return dbInstance;
};

/**
 * @param {import("drizzle-orm/postgres-js").PostgresJsDatabase} db
 * @param {string} chatId
 * @param {string} userId
 */
const getChatIfParticipant = async (db, chatId, userId) => {
  const [chat] = await db
    .select()
    .from(chats)
    .where(eq(chats.id, chatId))
    .limit(1);

  if (!chat) return { chat: null, isMember: false };

  const [membership] = await db
    .select({ chatId: chatParticipants.chatId })
    .from(chatParticipants)
    .where(
      and(
        eq(chatParticipants.chatId, chatId),
        eq(chatParticipants.userId, userId)
      )
    )
    .limit(1);

  return { chat, isMember: Boolean(membership) };
};

/**
 * @param {import("drizzle-orm/postgres-js").PostgresJsDatabase} db
 * @param {string} chatId
 */
const listParticipantIds = async (db, chatId) => {
  const rows = await db
    .select({ userId: chatParticipants.userId })
    .from(chatParticipants)
    .where(eq(chatParticipants.chatId, chatId));
  return rows.map((r) => r.userId);
};

const getAllMessages = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { chatId } = req.params;

  const { chat: selectedChat, isMember } = await getChatIfParticipant(
    db,
    chatId,
    req.user._id
  );

  if (!selectedChat) {
    throw new ApiError(404, "Chat does not exist");
  }

  if (!isMember) {
    throw new ApiError(400, "User is not a part of this chat");
  }

  const messages = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.chat, chatId))
    .orderBy(desc(chatMessages.createdAt));

  const hydrated = await hydrateChatMessages(db, messages);

  return res
    .status(200)
    .json(
      new ApiResponse(200, hydrated || [], "Messages fetched successfully")
    );
});

const sendMessage = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { chatId } = req.params;
  const { content } = req.body;

  if (!content && !req.files?.attachments?.length) {
    throw new ApiError(400, "Message content or attachment is required");
  }

  const { chat: selectedChat, isMember } = await getChatIfParticipant(
    db,
    chatId,
    req.user._id
  );

  if (!selectedChat) {
    throw new ApiError(404, "Chat does not exist");
  }

  if (!isMember) {
    throw new ApiError(400, "User is not a part of this chat");
  }

  /** @type {{ url: string, localPath: string }[]} */
  const messageFiles = [];

  if (req.files && req.files.attachments?.length > 0) {
    req.files.attachments?.forEach((attachment) => {
      messageFiles.push({
        url: getStaticFilePath(req, attachment.filename),
        localPath: getLocalPath(attachment.filename),
      });
    });
  }

  const message = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(chatMessages)
      .values({
        sender: req.user._id,
        content: content || "",
        chat: chatId,
      })
      .returning();

    if (messageFiles.length) {
      await tx.insert(chatMessageAttachments).values(
        messageFiles.map((file) => ({
          messageId: created.id,
          url: file.url,
          localPath: file.localPath,
        }))
      );
    }

    await tx
      .update(chats)
      .set({ lastMessage: created.id })
      .where(eq(chats.id, chatId));

    return created;
  });

  const [receivedMessage] = await hydrateChatMessages(db, [message]);

  if (!receivedMessage) {
    throw new ApiError(500, "Internal server error");
  }

  const participantIds = await listParticipantIds(db, chatId);

  participantIds.forEach((participantId) => {
    if (String(participantId) === String(req.user._id)) return;
    emitSocketEvent(
      req,
      String(participantId),
      ChatEventEnum.MESSAGE_RECEIVED_EVENT,
      receivedMessage
    );
  });

  return res
    .status(201)
    .json(new ApiResponse(201, receivedMessage, "Message saved successfully"));
});

const deleteMessage = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { chatId, messageId } = req.params;

  const { chat, isMember } = await getChatIfParticipant(
    db,
    chatId,
    req.user._id
  );

  if (!chat || !isMember) {
    throw new ApiError(404, "Chat does not exist");
  }

  const [message] = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.id, messageId))
    .limit(1);

  if (!message) {
    throw new ApiError(404, "Message does not exist");
  }

  if (String(message.sender) !== String(req.user._id)) {
    throw new ApiError(
      403,
      "You are not the authorised to delete the message, you are not the sender"
    );
  }

  const attachmentMap = await loadAttachmentsByMessageIds(db, [messageId]);
  const attachments = attachmentMap.get(messageId) ?? [];

  for (const asset of attachments) {
    removeLocalFile(asset.localPath);
  }

  // Return the pre-delete message with sender as id string (not populated).
  const responsePayload = shapeChatMessage(
    message,
    attachments,
    message.sender
  );

  await db.delete(chatMessages).where(eq(chatMessages.id, messageId));

  if (chat.lastMessage && String(chat.lastMessage) === String(message.id)) {
    const [lastMessage] = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.chat, chatId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(1);

    await db
      .update(chats)
      .set({ lastMessage: lastMessage ? lastMessage.id : null })
      .where(eq(chats.id, chatId));
  }

  const participantIds = await listParticipantIds(db, chatId);

  participantIds.forEach((participantId) => {
    if (String(participantId) === String(req.user._id)) return;
    emitSocketEvent(
      req,
      String(participantId),
      ChatEventEnum.MESSAGE_DELETE_EVENT,
      responsePayload
    );
  });

  return res
    .status(200)
    .json(
      new ApiResponse(200, responsePayload, "Message deleted successfully")
    );
});

export { getAllMessages, sendMessage, deleteMessage };
