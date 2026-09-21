import { and, count, eq, inArray } from "drizzle-orm";
import { dbInstance } from "@/db/index.js";
import { users } from "@/models/apps/auth/user.models.js";
import { socialComments } from "@/models/apps/social-media/comment.models.js";
import { socialLikes } from "@/models/apps/social-media/like.models.js";
import { socialProfiles } from "@/models/apps/social-media/profile.models.js";
import { shapeUser, withId } from "@/models/serializers.js";
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
 * @param {typeof users.$inferSelect} user
 */
const shapeCommentAuthorAccount = (user) => {
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
 * @param {import("drizzle-orm/postgres-js").PostgresJsDatabase} db
 * @param {typeof socialComments.$inferSelect[]} comments
 * @param {string | null | undefined} viewerId
 */
const hydrateComments = async (db, comments, viewerId) => {
  if (!comments.length) return [];

  const commentIds = comments.map((c) => c.id);
  const authorIds = [
    ...new Set(comments.map((c) => c.author).filter(Boolean)),
  ];

  const [likeCountRows, profiles, authorUsers] = await Promise.all([
    db
      .select({
        commentId: socialLikes.commentId,
        value: count(),
      })
      .from(socialLikes)
      .where(inArray(socialLikes.commentId, commentIds))
      .groupBy(socialLikes.commentId),
    authorIds.length
      ? db
          .select()
          .from(socialProfiles)
          .where(inArray(socialProfiles.owner, authorIds))
      : Promise.resolve([]),
    authorIds.length
      ? db.select().from(users).where(inArray(users.id, authorIds))
      : Promise.resolve([]),
  ]);

  /** @type {Set<string>} */
  const likedSet = new Set();
  if (viewerId) {
    const likedRows = await db
      .select({ commentId: socialLikes.commentId })
      .from(socialLikes)
      .where(
        and(
          inArray(socialLikes.commentId, commentIds),
          eq(socialLikes.likedBy, viewerId)
        )
      );
    for (const row of likedRows) {
      if (row.commentId) likedSet.add(row.commentId);
    }
  }

  const likeCountMap = new Map(
    likeCountRows.map((r) => [r.commentId, Number(r.value)])
  );
  const profileByOwner = new Map(profiles.map((p) => [p.owner, p]));
  const userById = new Map(authorUsers.map((u) => [u.id, u]));

  return comments.map((comment) => {
    const profile = comment.author
      ? profileByOwner.get(comment.author)
      : null;
    const authorUser = comment.author
      ? userById.get(comment.author)
      : null;

    const author = profile
      ? {
          _id: profile.id,
          firstName: profile.firstName,
          lastName: profile.lastName,
          account: authorUser ? shapeCommentAuthorAccount(authorUser) : null,
        }
      : null;

    return {
      ...withId(comment),
      author,
      likes: likeCountMap.get(comment.id) ?? 0,
      isLiked: likedSet.has(comment.id),
    };
  });
};

const addComment = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { postId } = req.params;
  const { content } = req.body;

  const [comment] = await db
    .insert(socialComments)
    .values({
      content,
      author: req.user?._id,
      postId,
    })
    .returning();

  return res
    .status(201)
    .json(new ApiResponse(201, withId(comment), "Comment added successfully"));
});

const getPostComments = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { postId } = req.params;
  const { page = 1, limit = 10 } = req.query;
  const postFilter = eq(socialComments.postId, postId);

  const comments = await aggregatePaginate({
    page,
    limit,
    customLabels: {
      totalDocs: "totalComments",
      docs: "comments",
    },
    getTotalDocs: async () => {
      const [row] = await db
        .select({ value: count() })
        .from(socialComments)
        .where(postFilter);
      return Number(row?.value ?? 0);
    },
    getDocs: async ({ limit: take, offset }) => {
      const rows = await db
        .select()
        .from(socialComments)
        .where(postFilter)
        .limit(take)
        .offset(offset);
      return hydrateComments(db, rows, req.user?._id);
    },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, comments, "Post comments fetched successfully"));
});

const deleteComment = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { commentId } = req.params;

  const [deletedComment] = await db
    .delete(socialComments)
    .where(
      and(
        eq(socialComments.id, commentId),
        eq(socialComments.author, req.user._id)
      )
    )
    .returning();

  if (!deletedComment) {
    throw new ApiError(
      404,
      "Comment is already deleted or you are not authorized for this action."
    );
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { deletedComment: withId(deletedComment) },
        "Comment deleted successfully"
      )
    );
});

const updateComment = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { commentId } = req.params;
  const { content } = req.body;

  const [updatedComment] = await db
    .update(socialComments)
    .set({ content })
    .where(
      and(
        eq(socialComments.id, commentId),
        eq(socialComments.author, req.user._id)
      )
    )
    .returning();

  if (!updatedComment) {
    throw new ApiError(
      404,
      "Comment does not exist or you are not authorized for this action."
    );
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        withId(updatedComment),
        "Comment updated successfully"
      )
    );
});

export { addComment, getPostComments, deleteComment, updateComment };
