import { and, eq } from "drizzle-orm";
import { dbInstance } from "@/db/index.js";
import { socialComments } from "@/models/apps/social-media/comment.models.js";
import { socialLikes } from "@/models/apps/social-media/like.models.js";
import { socialPosts } from "@/models/apps/social-media/post.models.js";
import { ApiError } from "@/utils/ApiError.js";
import { ApiResponse } from "@/utils/ApiResponse.js";
import { asyncHandler } from "@/utils/asyncHandler.js";

const requireDb = () => {
  if (!dbInstance) {
    throw new ApiError(500, "Database is not connected");
  }
  return dbInstance;
};

const likeDislikePost = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { postId } = req.params;

  const [post] = await db
    .select({ id: socialPosts.id })
    .from(socialPosts)
    .where(eq(socialPosts.id, postId))
    .limit(1);

  if (!post) {
    throw new ApiError(404, "Post does not exist");
  }

  const [isAlreadyLiked] = await db
    .select()
    .from(socialLikes)
    .where(
      and(eq(socialLikes.postId, postId), eq(socialLikes.likedBy, req.user._id))
    )
    .limit(1);

  if (isAlreadyLiked) {
    await db
      .delete(socialLikes)
      .where(
        and(
          eq(socialLikes.postId, postId),
          eq(socialLikes.likedBy, req.user._id)
        )
      );
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          isLiked: false,
        },
        "Unliked successfully"
      )
    );
  }

  await db.insert(socialLikes).values({
    postId,
    likedBy: req.user._id,
  });
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        isLiked: true,
      },
      "Liked successfully"
    )
  );
});

const likeDislikeComment = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { commentId } = req.params;

  const [comment] = await db
    .select({ id: socialComments.id })
    .from(socialComments)
    .where(eq(socialComments.id, commentId))
    .limit(1);

  if (!comment) {
    throw new ApiError(404, "Comment does not exist");
  }

  const [isAlreadyLiked] = await db
    .select()
    .from(socialLikes)
    .where(
      and(
        eq(socialLikes.commentId, commentId),
        eq(socialLikes.likedBy, req.user._id)
      )
    )
    .limit(1);

  if (isAlreadyLiked) {
    await db
      .delete(socialLikes)
      .where(
        and(
          eq(socialLikes.commentId, commentId),
          eq(socialLikes.likedBy, req.user._id)
        )
      );
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          isLiked: false,
        },
        "Unliked successfully"
      )
    );
  }

  await db.insert(socialLikes).values({
    commentId,
    likedBy: req.user._id,
  });
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        isLiked: true,
      },
      "Liked successfully"
    )
  );
});

export { likeDislikePost, likeDislikeComment };
