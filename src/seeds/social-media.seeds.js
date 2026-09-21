import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { dbInstance } from "@/db/index.js";
import { users } from "@/models/apps/auth/user.models.js";
import { socialBookmarks } from "@/models/apps/social-media/bookmark.models.js";
import { socialComments } from "@/models/apps/social-media/comment.models.js";
import { socialFollows } from "@/models/apps/social-media/follow.models.js";
import { socialLikes } from "@/models/apps/social-media/like.models.js";
import {
  socialPostImages,
  socialPosts,
} from "@/models/apps/social-media/post.models.js";
import { socialProfiles } from "@/models/apps/social-media/profile.models.js";
import { ApiError } from "@/utils/ApiError.js";
import { ApiResponse } from "@/utils/ApiResponse.js";
import { asyncHandler } from "@/utils/asyncHandler.js";
import { getRandomNumber } from "@/utils/helpers.js";
import {
  SOCIAL_BOOKMARKS_COUNT as SOCIAL_BOOKMARKS_COUNT_FULL,
  SOCIAL_COMMENTS_COUNT as SOCIAL_COMMENTS_COUNT_FULL,
  SOCIAL_FOLLOWS_COUNT as SOCIAL_FOLLOWS_COUNT_FULL,
  SOCIAL_LIKES_COUNT as SOCIAL_LIKES_COUNT_FULL,
  SOCIAL_POSTS_COUNT as SOCIAL_POSTS_COUNT_FULL,
  SOCIAL_POST_IMAGES_COUNT,
} from "@/seeds/_constants.js";

/** Full seed volumes in app; shrink under Jest so Neon pooler survives. */
const isJest = typeof process.env.JEST_WORKER_ID !== "undefined";
const SOCIAL_POSTS_COUNT = isJest ? 12 : SOCIAL_POSTS_COUNT_FULL;
const SOCIAL_COMMENTS_COUNT = isJest ? 20 : SOCIAL_COMMENTS_COUNT_FULL;
const SOCIAL_LIKES_COUNT = isJest ? 40 : SOCIAL_LIKES_COUNT_FULL;
const SOCIAL_FOLLOWS_COUNT = isJest ? 30 : SOCIAL_FOLLOWS_COUNT_FULL;
const SOCIAL_BOOKMARKS_COUNT = isJest ? 15 : SOCIAL_BOOKMARKS_COUNT_FULL;

/** Keep batches small — Neon/pgbouncer chokes on huge multi-row INSERT…RETURNING. */
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
    `Social media seed failed at ${step}`,
    cause?.code,
    cause?.constraint_name,
    cause?.detail || cause?.message,
  ]
    .filter(Boolean)
    .join(": ");
  throw new ApiError(500, message);
};

const postBlueprints = new Array(SOCIAL_POSTS_COUNT).fill("_").map(() => ({
  content: faker.lorem.paragraphs({ min: 1, max: 2 }, "\n"),
  tags: faker.lorem.words({ min: 3, max: 8 }).split(" "),
  images: new Array(SOCIAL_POST_IMAGES_COUNT).fill("_").map(() => ({
    url: faker.image.urlLoremFlickr({
      category: "food",
    }),
    localPath: "",
  })),
}));

const commentBlueprints = new Array(SOCIAL_COMMENTS_COUNT).fill("_").map(() => ({
  content: faker.lorem.paragraph(),
}));

const clearSocialDomain = async (db) => {
  // Children first — avoid relying solely on CASCADE under pooler races.
  await db.delete(socialLikes);
  await db.delete(socialBookmarks);
  await db.delete(socialFollows);
  await db.delete(socialComments);
  await db.delete(socialPostImages);
  await db.delete(socialPosts);
};

const seedSocialProfiles = async (db) => {
  const profiles = await db.select().from(socialProfiles);

  // Sequential — Promise.all exhausts Neon session pooler (max connections).
  for (const profile of profiles) {
    await db
      .update(socialProfiles)
      .set({
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        bio: faker.person.bio(),
        dob: faker.date.past({
          years: 18,
        }),
        location: `${faker.location.city()}, ${faker.location.country()}`,
        countryCode: "+91",
        phoneNumber: faker.string.numeric({ length: 10, allowLeadingZeros: false }),
      })
      .where(eq(socialProfiles.id, profile.id));
  }
};

const seedSocialPosts = async (db, allUsers) => {
  if (!allUsers.length || postBlueprints.length === 0) return [];

  const postRows = postBlueprints.map((blueprint, i) => {
    const { images: _images, ...postFields } = blueprint;
    return {
      ...postFields,
      author: allUsers[i]?.id ?? allUsers[getRandomNumber(allUsers.length)].id,
    };
  });

  /** @type {typeof socialPosts.$inferSelect[]} */
  const createdPosts = [];
  for (const batch of chunk(postRows, INSERT_BATCH)) {
    const inserted = await db.insert(socialPosts).values(batch).returning();
    createdPosts.push(...inserted);
  }

  /** @type {{ postId: string, url: string, localPath: string }[]} */
  const imageRows = [];
  for (let i = 0; i < createdPosts.length; i++) {
    for (const img of postBlueprints[i].images) {
      imageRows.push({
        postId: createdPosts[i].id,
        url: img.url,
        localPath: img.localPath,
      });
    }
  }

  for (const batch of chunk(imageRows, INSERT_BATCH)) {
    await db.insert(socialPostImages).values(batch);
  }

  return createdPosts;
};

const seedSocialComments = async (db, allUsers, allPosts) => {
  if (!allPosts.length || !allUsers.length || commentBlueprints.length === 0) {
    return [];
  }

  const rows = commentBlueprints.map((comment) => ({
    content: comment.content,
    author: allUsers[getRandomNumber(allUsers.length)].id,
    postId: allPosts[getRandomNumber(allPosts.length)].id,
  }));

  /** @type {typeof socialComments.$inferSelect[]} */
  const created = [];
  for (const batch of chunk(rows, INSERT_BATCH)) {
    const inserted = await db.insert(socialComments).values(batch).returning();
    created.push(...inserted);
  }
  return created;
};

const seedSocialLikes = async (db, allUsers, allPosts, allComments) => {
  if (!allUsers.length) return;

  /** @type {Set<string>} */
  const seen = new Set();
  /** @type {{ postId: string, likedBy: string }[]} */
  const postLikeRows = [];
  /** @type {{ commentId: string, likedBy: string }[]} */
  const commentLikeRows = [];

  if (allPosts.length) {
    for (let i = 0; i < SOCIAL_LIKES_COUNT; i++) {
      const likedBy = allUsers[getRandomNumber(allUsers.length)];
      const post = allPosts[getRandomNumber(allPosts.length)];
      const key = `p:${post.id}:${likedBy.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      postLikeRows.push({ postId: post.id, likedBy: likedBy.id });
    }
  }

  if (allComments.length) {
    for (let i = 0; i < SOCIAL_LIKES_COUNT; i++) {
      const likedBy = allUsers[getRandomNumber(allUsers.length)];
      const comment = allComments[getRandomNumber(allComments.length)];
      const key = `c:${comment.id}:${likedBy.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      commentLikeRows.push({ commentId: comment.id, likedBy: likedBy.id });
    }
  }

  for (const batch of chunk(postLikeRows, INSERT_BATCH)) {
    await db.insert(socialLikes).values(batch);
  }
  for (const batch of chunk(commentLikeRows, INSERT_BATCH)) {
    await db.insert(socialLikes).values(batch);
  }
};

const seedSocialFollowers = async (db, allUsers) => {
  if (allUsers.length < 2) return;

  /** @type {Set<string>} */
  const seen = new Set();
  /** @type {{ followerId: string, followeeId: string }[]} */
  const rows = [];

  for (let i = 0; i < SOCIAL_FOLLOWS_COUNT; i++) {
    let followerIndex = getRandomNumber(allUsers.length);
    let followeeIndex = getRandomNumber(allUsers.length);
    if (followeeIndex === followerIndex) {
      followerIndex <= 0 ? followerIndex++ : followerIndex--;
    }
    const follower = allUsers[followerIndex];
    const followee = allUsers[followeeIndex];
    const key = `${follower.id}:${followee.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      followerId: follower.id,
      followeeId: followee.id,
    });
  }

  for (const batch of chunk(rows, INSERT_BATCH)) {
    await db.insert(socialFollows).values(batch);
  }
};

const seedSocialBookmarks = async (db, allUsers, allPosts) => {
  if (!allUsers.length || !allPosts.length) return;

  /** @type {Set<string>} */
  const seen = new Set();
  /** @type {{ postId: string, bookmarkedBy: string }[]} */
  const rows = [];

  for (let i = 0; i < SOCIAL_BOOKMARKS_COUNT; i++) {
    const bookmarkedBy = allUsers[getRandomNumber(allUsers.length)];
    const post = allPosts[getRandomNumber(allPosts.length)];
    const key = `${post.id}:${bookmarkedBy.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      postId: post.id,
      bookmarkedBy: bookmarkedBy.id,
    });
  }

  for (const batch of chunk(rows, INSERT_BATCH)) {
    await db.insert(socialBookmarks).values(batch);
  }
};

const seedSocialMedia = asyncHandler(async (req, res) => {
  const db = requireDb();
  const allUsers = await db.select({ id: users.id }).from(users);

  if (!allUsers.length) {
    throw new ApiError(
      400,
      "No users found. Seed users before seeding social media."
    );
  }

  try {
    await clearSocialDomain(db);
    await seedSocialProfiles(db);
    const allPosts = await seedSocialPosts(db, allUsers);
    const allComments = await seedSocialComments(db, allUsers, allPosts);
    await seedSocialLikes(db, allUsers, allPosts, allComments);
    await seedSocialFollowers(db, allUsers);
    await seedSocialBookmarks(db, allUsers, allPosts);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    rethrowSeedError(err, "domain populate");
  }

  return res
    .status(201)
    .json(
      new ApiResponse(
        201,
        {},
        "Database populated for social media successfully"
      )
    );
});

export { seedSocialMedia };
