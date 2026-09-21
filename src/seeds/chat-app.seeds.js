import { faker } from "@faker-js/faker";
import { dbInstance } from "@/db/index.js";
import { users } from "@/models/apps/auth/user.models.js";
import {
  chatParticipants,
  chats,
} from "@/models/apps/chat-app/chat.models.js";
import {
  chatMessageAttachments,
  chatMessages,
} from "@/models/apps/chat-app/message.models.js";
import { ApiError } from "@/utils/ApiError.js";
import { ApiResponse } from "@/utils/ApiResponse.js";
import { asyncHandler } from "@/utils/asyncHandler.js";
import { getRandomNumber } from "@/utils/helpers.js";
import {
  GROUP_CHATS_COUNT as GROUP_CHATS_COUNT_FULL,
  GROUP_CHAT_MAX_PARTICIPANTS_COUNT,
  ONE_ON_ONE_CHATS_COUNT as ONE_ON_ONE_CHATS_COUNT_FULL,
} from "@/seeds/_constants.js";

/** Full seed volumes in app; shrink under Jest so Neon pooler survives. */
const isJest = typeof process.env.JEST_WORKER_ID !== "undefined";
const ONE_ON_ONE_CHATS_COUNT = isJest ? 8 : ONE_ON_ONE_CHATS_COUNT_FULL;
const GROUP_CHATS_COUNT = isJest ? 4 : GROUP_CHATS_COUNT_FULL;

const INSERT_BATCH = 50;

const requireDb = () => {
  if (!dbInstance) {
    throw new ApiError(500, "Database is not connected");
  }
  return dbInstance;
};

/**
 * @template T
 * @param {T[]} arr
 * @param {number} size
 */
const chunk = (arr, size) => {
  /** @type {T[][]} */
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
};

/**
 * @param {unknown} err
 * @param {string} step
 * @returns {never}
 */
const rethrowSeedError = (err, step) => {
  const cause =
    err && typeof err === "object" && "cause" in err
      ? /** @type {{ code?: string, detail?: string, constraint_name?: string, message?: string }} */ (
          err.cause
        )
      : undefined;
  const message = [
    `Chat app seed failed at ${step}`,
    cause?.code,
    cause?.constraint_name,
    cause?.detail || cause?.message,
  ]
    .filter(Boolean)
    .join(": ");
  throw new ApiError(500, message);
};

const clearChatDomain = async (db) => {
  await db.delete(chatMessageAttachments);
  await db.delete(chatMessages);
  await db.delete(chatParticipants);
  await db.delete(chats);
};

/**
 * Pair set key so we do not insert duplicate one-on-one chats for the same duo.
 * @param {string} a
 * @param {string} b
 */
const pairKey = (a, b) => (a < b ? `${a}:${b}` : `${b}:${a}`);

const seedOneOnOneChats = async (db, userRows) => {
  if (userRows.length < 2) return;

  /** @type {Set<string>} */
  const seen = new Set();
  /** @type {{ name: string, isGroupChat: boolean, admin: string, participantIds: string[] }[]} */
  const blueprints = [];

  let attempts = 0;
  const maxAttempts = ONE_ON_ONE_CHATS_COUNT * 20;

  while (
    blueprints.length < ONE_ON_ONE_CHATS_COUNT &&
    attempts < maxAttempts
  ) {
    attempts += 1;
    let index1 = getRandomNumber(userRows.length);
    let index2 = getRandomNumber(userRows.length);
    if (index1 === index2) {
      index2 <= 0 ? index2++ : index2--;
    }

    const a = userRows[index1].id;
    const b = userRows[index2].id;
    const key = pairKey(a, b);
    if (seen.has(key)) continue;
    seen.add(key);

    const participantIds = [a, b];
    blueprints.push({
      name: "One on one chat",
      isGroupChat: false,
      admin: participantIds[getRandomNumber(participantIds.length)],
      participantIds,
    });
  }

  for (const batch of chunk(blueprints, INSERT_BATCH)) {
    for (const bp of batch) {
      const [chat] = await db
        .insert(chats)
        .values({
          name: bp.name,
          isGroupChat: bp.isGroupChat,
          admin: bp.admin,
        })
        .returning();

      await db.insert(chatParticipants).values(
        bp.participantIds.map((userId) => ({
          chatId: chat.id,
          userId,
        }))
      );
    }
  }
};

const seedGroupChats = async (db, userRows) => {
  if (userRows.length < 3) return;

  for (let i = 0; i < GROUP_CHATS_COUNT; i++) {
    const participantsCount = getRandomNumber(
      GROUP_CHAT_MAX_PARTICIPANTS_COUNT
    );
    const target = participantsCount < 3 ? 3 : participantsCount;

    /** @type {string[]} */
    let participantIds = [];
    new Array(target).fill("_").forEach(() => {
      participantIds.push(userRows[getRandomNumber(userRows.length)].id);
    });
    participantIds = [...new Set(participantIds)];

    // Ensure minimum 3 after dedupe — top up if needed.
    while (participantIds.length < 3 && userRows.length >= 3) {
      const id = userRows[getRandomNumber(userRows.length)].id;
      if (!participantIds.includes(id)) participantIds.push(id);
    }

    if (participantIds.length < 3) continue;

    const [chat] = await db
      .insert(chats)
      .values({
        name: faker.vehicle.vehicle() + faker.company.buzzNoun(),
        isGroupChat: true,
        admin: participantIds[getRandomNumber(participantIds.length)],
      })
      .returning();

    await db.insert(chatParticipants).values(
      participantIds.map((userId) => ({
        chatId: chat.id,
        userId,
      }))
    );
  }
};

const seedChatApp = asyncHandler(async (req, res) => {
  const db = requireDb();

  try {
    await clearChatDomain(db);
  } catch (err) {
    rethrowSeedError(err, "clear");
  }

  const userRows = await db.select({ id: users.id }).from(users);
  if (!userRows.length) {
    throw new ApiError(
      400,
      "No users found. Seed users before seeding the chat app."
    );
  }

  try {
    await seedOneOnOneChats(db, userRows);
  } catch (err) {
    rethrowSeedError(err, "one-on-one chats");
  }

  try {
    await seedGroupChats(db, userRows);
  } catch (err) {
    rethrowSeedError(err, "group chats");
  }

  return res
    .status(201)
    .json(
      new ApiResponse(201, {}, "Database populated for chat app successfully")
    );
});

export { seedChatApp };
