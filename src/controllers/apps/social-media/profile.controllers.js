import { and, count, eq } from "drizzle-orm";
import { dbInstance } from "@/db/index.js";
import { users } from "@/models/apps/auth/user.models.js";
import { socialFollows } from "@/models/apps/social-media/follow.models.js";
import { socialProfiles } from "@/models/apps/social-media/profile.models.js";
import { shapeSocialProfile, shapeUser } from "@/models/serializers.js";
import { ApiError } from "@/utils/ApiError.js";
import { ApiResponse } from "@/utils/ApiResponse.js";
import { asyncHandler } from "@/utils/asyncHandler.js";
import {
  getLocalPath,
  getStaticFilePath,
  removeLocalFile,
} from "@/utils/helpers.js";

const requireDb = () => {
  if (!dbInstance) {
    throw new ApiError(500, "Database is not connected");
  }
  return dbInstance;
};

/**
 * @param {string} userId
 * @param {import("express").Request} req
 */
export const getUserSocialProfile = async (userId, req) => {
  const db = requireDb();

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  const [profile] = await db
    .select()
    .from(socialProfiles)
    .where(eq(socialProfiles.owner, userId))
    .limit(1);

  if (!profile) {
    throw new ApiError(404, "User profile does not exist");
  }

  const [[followersRow], [followingRow]] = await Promise.all([
    db
      .select({ value: count() })
      .from(socialFollows)
      .where(eq(socialFollows.followeeId, userId)),
    db
      .select({ value: count() })
      .from(socialFollows)
      .where(eq(socialFollows.followerId, userId)),
  ]);

  let isFollowing = false;
  if (req.user?._id && req.user._id.toString() !== userId.toString()) {
    const [followInstance] = await db
      .select({ id: socialFollows.id })
      .from(socialFollows)
      .where(
        and(
          eq(socialFollows.followerId, req.user._id),
          eq(socialFollows.followeeId, userId)
        )
      )
      .limit(1);
    isFollowing = Boolean(followInstance);
  }

  const shapedUser = shapeUser(user);
  const account = {
    _id: shapedUser._id,
    avatar: shapedUser.avatar,
    username: shapedUser.username,
    email: shapedUser.email,
    isEmailVerified: shapedUser.isEmailVerified,
  };

  return {
    ...shapeSocialProfile(profile),
    account,
    followersCount: Number(followersRow?.value ?? 0),
    followingCount: Number(followingRow?.value ?? 0),
    isFollowing,
  };
};

const getMySocialProfile = asyncHandler(async (req, res) => {
  const profile = await getUserSocialProfile(req.user._id, req);
  return res
    .status(200)
    .json(new ApiResponse(200, profile, "User profile fetched successfully"));
});

const getProfileByUserName = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { username } = req.params;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username.toLowerCase()))
    .limit(1);

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  const userProfile = await getUserSocialProfile(user.id, req);

  return res
    .status(200)
    .json(
      new ApiResponse(200, userProfile, "User profile fetched successfully")
    );
});

const updateSocialProfile = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { firstName, lastName, phoneNumber, countryCode, bio, dob, location } =
    req.body;

  /** @type {Record<string, unknown>} */
  const patch = {};
  if (firstName !== undefined) patch.firstName = firstName;
  if (lastName !== undefined) patch.lastName = lastName;
  if (phoneNumber !== undefined) patch.phoneNumber = phoneNumber;
  if (countryCode !== undefined) patch.countryCode = countryCode;
  if (bio !== undefined) patch.bio = bio;
  if (location !== undefined) patch.location = location;
  if (dob !== undefined) patch.dob = dob ? new Date(dob) : null;

  if (Object.keys(patch).length > 0) {
    await db
      .update(socialProfiles)
      .set(patch)
      .where(eq(socialProfiles.owner, req.user._id));
  }

  const profile = await getUserSocialProfile(req.user._id, req);

  return res
    .status(200)
    .json(new ApiResponse(200, profile, "User profile updated successfully"));
});

const updateCoverImage = asyncHandler(async (req, res) => {
  const db = requireDb();

  if (!req.file?.filename) {
    throw new ApiError(400, "Cover image is required");
  }

  const coverImageUrl = getStaticFilePath(req, req.file?.filename);
  const coverImageLocalPath = getLocalPath(req.file?.filename);

  const [profile] = await db
    .select()
    .from(socialProfiles)
    .where(eq(socialProfiles.owner, req.user._id))
    .limit(1);

  if (!profile) {
    throw new ApiError(404, "User profile does not exist");
  }

  await db
    .update(socialProfiles)
    .set({
      coverImageUrl,
      coverImageLocalPath,
    })
    .where(eq(socialProfiles.owner, req.user._id));

  removeLocalFile(profile.coverImageLocalPath);

  const updatedProfile = await getUserSocialProfile(req.user._id, req);

  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedProfile, "Cover image updated successfully")
    );
});

export {
  getMySocialProfile,
  getProfileByUserName,
  updateSocialProfile,
  updateCoverImage,
};
