import { and, count, eq, inArray } from "drizzle-orm";
import { dbInstance } from "@/db/index.js";
import { users } from "@/models/apps/auth/user.models.js";
import { socialFollows } from "@/models/apps/social-media/follow.models.js";
import { socialProfiles } from "@/models/apps/social-media/profile.models.js";
import { shapeSocialProfile, shapeUser } from "@/models/serializers.js";
import { ApiError } from "@/utils/ApiError.js";
import { ApiResponse } from "@/utils/ApiResponse.js";
import { asyncHandler } from "@/utils/asyncHandler.js";
import { aggregatePaginate } from "@/utils/helpers.js";

const requireDb = () => {
  if (!dbInstance) {
    throw new ApiError(500, "Database is not connected");
  }
  return dbInstance;
};

/**
 * Slim user+profile shape for follow list header.
 * @param {typeof users.$inferSelect} user
 * @param {typeof socialProfiles.$inferSelect | undefined} profile
 */
const shapeFollowListHeaderUser = (user, profile) => {
  const shaped = shapeUser(user);
  const shapedProfile = profile
    ? (() => {
        const full = shapeSocialProfile(profile);
        return {
          _id: full._id,
          firstName: full.firstName,
          lastName: full.lastName,
          bio: full.bio,
          location: full.location,
          countryCode: full.countryCode,
          phoneNumber: full.phoneNumber,
          coverImage: full.coverImage,
        };
      })()
    : null;

  return {
    _id: shaped._id,
    username: shaped.username,
    email: shaped.email,
    isEmailVerified: shaped.isEmailVerified,
    avatar: shaped.avatar,
    profile: shapedProfile,
  };
};

/**
 * Follower/following list item shape.
 * @param {typeof users.$inferSelect} user
 * @param {typeof socialProfiles.$inferSelect | undefined} profile
 * @param {boolean} isFollowing
 */
const shapeFollowListItem = (user, profile, isFollowing) => {
  const shaped = shapeUser(user);
  return {
    _id: shaped._id,
    username: shaped.username,
    email: shaped.email,
    avatar: shaped.avatar,
    profile: profile ? shapeSocialProfile(profile) : null,
    isFollowing,
  };
};

/**
 * @param {import("drizzle-orm/postgres-js").PostgresJsDatabase} db
 * @param {string} username
 */
const loadUserForFollowList = async (db, username) => {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username.toLowerCase()))
    .limit(1);

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  const [profile] = await db
    .select()
    .from(socialProfiles)
    .where(eq(socialProfiles.owner, user.id))
    .limit(1);

  return {
    userRow: user,
    header: shapeFollowListHeaderUser(user, profile),
  };
};

/**
 * @param {import("drizzle-orm/postgres-js").PostgresJsDatabase} db
 * @param {string[]} userIds
 * @param {string | null | undefined} viewerId
 */
const hydrateFollowListUsers = async (db, userIds, viewerId) => {
  if (!userIds.length) return [];

  const [userRows, profileRows] = await Promise.all([
    db.select().from(users).where(inArray(users.id, userIds)),
    db
      .select()
      .from(socialProfiles)
      .where(inArray(socialProfiles.owner, userIds)),
  ]);

  /** @type {Set<string>} */
  const followingSet = new Set();
  if (viewerId) {
    const followRows = await db
      .select({ followeeId: socialFollows.followeeId })
      .from(socialFollows)
      .where(
        and(
          eq(socialFollows.followerId, viewerId),
          inArray(socialFollows.followeeId, userIds)
        )
      );
    for (const row of followRows) {
      if (row.followeeId) followingSet.add(row.followeeId);
    }
  }

  const userById = new Map(userRows.map((u) => [u.id, u]));
  const profileByOwner = new Map(profileRows.map((p) => [p.owner, p]));

  return userIds
    .map((id) => {
      const user = userById.get(id);
      if (!user) return null;
      return shapeFollowListItem(
        user,
        profileByOwner.get(id),
        followingSet.has(id)
      );
    })
    .filter(Boolean);
};

const followUnFollowUser = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { toBeFollowedUserId } = req.params;

  const [toBeFollowed] = await db
    .select()
    .from(users)
    .where(eq(users.id, toBeFollowedUserId))
    .limit(1);

  if (!toBeFollowed) {
    throw new ApiError(404, "User does not exist");
  }

  if (toBeFollowedUserId.toString() === req.user._id.toString()) {
    throw new ApiError(422, "You cannot follow yourself");
  }

  const [isAlreadyFollowing] = await db
    .select()
    .from(socialFollows)
    .where(
      and(
        eq(socialFollows.followerId, req.user._id),
        eq(socialFollows.followeeId, toBeFollowed.id)
      )
    )
    .limit(1);

  if (isAlreadyFollowing) {
    await db
      .delete(socialFollows)
      .where(
        and(
          eq(socialFollows.followerId, req.user._id),
          eq(socialFollows.followeeId, toBeFollowed.id)
        )
      );
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          following: false,
        },
        "Un-followed successfully"
      )
    );
  }

  await db.insert(socialFollows).values({
    followerId: req.user._id,
    followeeId: toBeFollowed.id,
  });
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        following: true,
      },
      "Followed successfully"
    )
  );
});

const getFollowersListByUserName = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { username } = req.params;
  const { page = 1, limit = 10 } = req.query;

  const { header, userRow } = await loadUserForFollowList(db, username);
  const followeeFilter = eq(socialFollows.followeeId, userRow.id);

  const followersList = await aggregatePaginate({
    page,
    limit,
    customLabels: {
      totalDocs: "totalFollowers",
      docs: "followers",
    },
    getTotalDocs: async () => {
      const [row] = await db
        .select({ value: count() })
        .from(socialFollows)
        .where(followeeFilter);
      return Number(row?.value ?? 0);
    },
    getDocs: async ({ limit: take, offset }) => {
      const rows = await db
        .select()
        .from(socialFollows)
        .where(followeeFilter)
        .limit(take)
        .offset(offset);

      const followerIds = rows
        .map((r) => r.followerId)
        .filter(Boolean);

      return hydrateFollowListUsers(db, followerIds, req.user?._id);
    },
  });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { user: header, ...followersList },
        "Followers list fetched successfully"
      )
    );
});

const getFollowingListByUserName = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { username } = req.params;
  const { page = 1, limit = 10 } = req.query;

  const { header, userRow } = await loadUserForFollowList(db, username);
  const followerFilter = eq(socialFollows.followerId, userRow.id);

  const followingList = await aggregatePaginate({
    page,
    limit,
    customLabels: {
      totalDocs: "totalFollowing",
      docs: "following",
    },
    getTotalDocs: async () => {
      const [row] = await db
        .select({ value: count() })
        .from(socialFollows)
        .where(followerFilter);
      return Number(row?.value ?? 0);
    },
    getDocs: async ({ limit: take, offset }) => {
      const rows = await db
        .select()
        .from(socialFollows)
        .where(followerFilter)
        .limit(take)
        .offset(offset);

      const followeeIds = rows
        .map((r) => r.followeeId)
        .filter(Boolean);

      return hydrateFollowListUsers(db, followeeIds, req.user?._id);
    },
  });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { user: header, ...followingList },
        "Following list fetched successfully"
      )
    );
});

export {
  followUnFollowUser,
  getFollowersListByUserName,
  getFollowingListByUserName,
};
