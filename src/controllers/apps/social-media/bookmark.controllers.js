import { and, eq } from "drizzle-orm";
import { dbInstance } from "@/db/index.js";
import { socialBookmarks } from "@/models/apps/social-media/bookmark.models.js";
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

const bookmarkUnBookmarkPost = asyncHandler(async (req, res) => {
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

  const [isAlreadyBookmarked] = await db
    .select()
    .from(socialBookmarks)
    .where(
      and(
        eq(socialBookmarks.postId, postId),
        eq(socialBookmarks.bookmarkedBy, req.user._id)
      )
    )
    .limit(1);

  if (isAlreadyBookmarked) {
    await db
      .delete(socialBookmarks)
      .where(
        and(
          eq(socialBookmarks.postId, postId),
          eq(socialBookmarks.bookmarkedBy, req.user._id)
        )
      );
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          isBookmarked: false,
        },
        "Bookmark removed successfully"
      )
    );
  }

  await db.insert(socialBookmarks).values({
    postId,
    bookmarkedBy: req.user._id,
  });
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        isBookmarked: true,
      },
      "Bookmarked successfully"
    )
  );
});

export { bookmarkUnBookmarkPost };
