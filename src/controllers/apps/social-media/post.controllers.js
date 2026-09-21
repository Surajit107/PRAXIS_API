import { and, arrayContains, count, eq, inArray } from "drizzle-orm";
import { MAXIMUM_SOCIAL_POST_IMAGE_COUNT } from "@/constants.js";
import { dbInstance } from "@/db/index.js";
import { users } from "@/models/apps/auth/user.models.js";
import { socialBookmarks } from "@/models/apps/social-media/bookmark.models.js";
import { socialComments } from "@/models/apps/social-media/comment.models.js";
import { socialLikes } from "@/models/apps/social-media/like.models.js";
import {
  socialPostImages,
  socialPosts,
} from "@/models/apps/social-media/post.models.js";
import { socialProfiles } from "@/models/apps/social-media/profile.models.js";
import {
  shapeSocialPost,
  shapeSocialProfile,
  shapeUser,
} from "@/models/serializers.js";
import { ApiError } from "@/utils/ApiError.js";
import { ApiResponse } from "@/utils/ApiResponse.js";
import { asyncHandler } from "@/utils/asyncHandler.js";
import {
  aggregatePaginate,
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
 * @param {import("drizzle-orm/postgres-js").PostgresJsDatabase} db
 * @param {string[]} postIds
 */
export const loadImagesByPostIds = async (db, postIds) => {
  /** @type {Map<string, typeof socialPostImages.$inferSelect[]>} */
  const map = new Map();
  if (!postIds.length) return map;

  const rows = await db
    .select()
    .from(socialPostImages)
    .where(inArray(socialPostImages.postId, postIds));

  for (const row of rows) {
    const list = map.get(row.postId) ?? [];
    list.push(row);
    map.set(row.postId, list);
  }
  return map;
};

/**
 * @param {typeof users.$inferSelect} user
 */
const shapePostAuthorAccount = (user) => {
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
 * Hydrate posts with images, counts, flags, and author profile+account.
 * @param {import("drizzle-orm/postgres-js").PostgresJsDatabase} db
 * @param {typeof socialPosts.$inferSelect[]} posts
 * @param {string | null | undefined} viewerId
 */
export const hydrateSocialPosts = async (db, posts, viewerId) => {
  if (!posts.length) return [];

  const postIds = posts.map((p) => p.id);
  const authorIds = [
    ...new Set(posts.map((p) => p.author).filter(Boolean)),
  ];

  const [imageMap, likeCountRows, commentCountRows, profiles, authorUsers] =
    await Promise.all([
      loadImagesByPostIds(db, postIds),
      db
        .select({
          postId: socialLikes.postId,
          value: count(),
        })
        .from(socialLikes)
        .where(inArray(socialLikes.postId, postIds))
        .groupBy(socialLikes.postId),
      db
        .select({
          postId: socialComments.postId,
          value: count(),
        })
        .from(socialComments)
        .where(inArray(socialComments.postId, postIds))
        .groupBy(socialComments.postId),
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
  /** @type {Set<string>} */
  const bookmarkedSet = new Set();

  if (viewerId) {
    const [likedRows, bookmarkedRows] = await Promise.all([
      db
        .select({ postId: socialLikes.postId })
        .from(socialLikes)
        .where(
          and(
            inArray(socialLikes.postId, postIds),
            eq(socialLikes.likedBy, viewerId)
          )
        ),
      db
        .select({ postId: socialBookmarks.postId })
        .from(socialBookmarks)
        .where(
          and(
            inArray(socialBookmarks.postId, postIds),
            eq(socialBookmarks.bookmarkedBy, viewerId)
          )
        ),
    ]);
    for (const row of likedRows) {
      if (row.postId) likedSet.add(row.postId);
    }
    for (const row of bookmarkedRows) {
      if (row.postId) bookmarkedSet.add(row.postId);
    }
  }

  const likeCountMap = new Map(
    likeCountRows.map((r) => [r.postId, Number(r.value)])
  );
  const commentCountMap = new Map(
    commentCountRows.map((r) => [r.postId, Number(r.value)])
  );
  const profileByOwner = new Map(profiles.map((p) => [p.owner, p]));
  const userById = new Map(authorUsers.map((u) => [u.id, u]));

  return posts.map((post) => {
    const profile = post.author ? profileByOwner.get(post.author) : null;
    const authorUser = post.author ? userById.get(post.author) : null;

    const author = profile
      ? {
          ...shapeSocialProfile(profile),
          account: authorUser ? shapePostAuthorAccount(authorUser) : null,
        }
      : null;

    return {
      ...shapeSocialPost(post, imageMap.get(post.id) ?? []),
      author,
      likes: likeCountMap.get(post.id) ?? 0,
      comments: commentCountMap.get(post.id) ?? 0,
      isLiked: likedSet.has(post.id),
      isBookmarked: bookmarkedSet.has(post.id),
    };
  });
};

/**
 * @param {import("drizzle-orm/postgres-js").PostgresJsDatabase} db
 * @param {string} postId
 * @param {string | null | undefined} viewerId
 */
export const getHydratedPostById = async (db, postId, viewerId) => {
  const [post] = await db
    .select()
    .from(socialPosts)
    .where(eq(socialPosts.id, postId))
    .limit(1);

  if (!post) return null;

  const [hydrated] = await hydrateSocialPosts(db, [post], viewerId);
  return hydrated;
};

const createPost = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { content, tags } = req.body;

  /** @type {{ url: string; localPath: string }[]} */
  const images =
    req.files?.images && req.files.images?.length
      ? req.files.images.map((image) => {
          const imageUrl = getStaticFilePath(req, image.filename);
          const imageLocalPath = getLocalPath(image.filename);
          return { url: imageUrl, localPath: imageLocalPath };
        })
      : [];

  const author = req.user._id;

  const created = await db.transaction(async (tx) => {
    const [post] = await tx
      .insert(socialPosts)
      .values({
        content,
        tags: tags || [],
        author,
      })
      .returning();

    if (!post) {
      throw new ApiError(500, "Error while creating a post");
    }

    if (images.length > 0) {
      await tx.insert(socialPostImages).values(
        images.map((img) => ({
          postId: post.id,
          url: img.url,
          localPath: img.localPath,
        }))
      );
    }

    return post;
  });

  const createdPost = await getHydratedPostById(db, created.id, req.user._id);

  return res
    .status(201)
    .json(new ApiResponse(201, createdPost, "Post created successfully"));
});

const updatePost = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { content, tags } = req.body;
  const { postId } = req.params;

  const [post] = await db
    .select()
    .from(socialPosts)
    .where(
      and(eq(socialPosts.id, postId), eq(socialPosts.author, req.user._id))
    )
    .limit(1);

  if (!post) {
    throw new ApiError(404, "Post does not exist");
  }

  /** @type {{ url: string; localPath: string }[]} */
  let images =
    req.files?.images && req.files.images?.length
      ? req.files.images.map((image) => {
          const imageUrl = getStaticFilePath(req, image.filename);
          const imageLocalPath = getLocalPath(image.filename);
          return { url: imageUrl, localPath: imageLocalPath };
        })
      : [];

  const existingImages = await db
    .select()
    .from(socialPostImages)
    .where(eq(socialPostImages.postId, postId));

  const existedImages = existingImages.length;
  const newImages = images.length;
  const totalImages = existedImages + newImages;

  if (totalImages > MAXIMUM_SOCIAL_POST_IMAGE_COUNT) {
    images?.map((img) => removeLocalFile(img.localPath));
    throw new ApiError(
      400,
      "Maximum " +
        MAXIMUM_SOCIAL_POST_IMAGE_COUNT +
        " images are allowed for a post. There are already " +
        existedImages +
        " images attached to the post."
    );
  }

  await db.transaction(async (tx) => {
    await tx
      .update(socialPosts)
      .set({
        content,
        tags,
      })
      .where(eq(socialPosts.id, postId));

    if (images.length > 0) {
      await tx.insert(socialPostImages).values(
        images.map((img) => ({
          postId,
          url: img.url,
          localPath: img.localPath,
        }))
      );
    }
  });

  const aggregatedPost = await getHydratedPostById(db, postId, req.user._id);

  return res
    .status(200)
    .json(new ApiResponse(200, aggregatedPost, "Post updated successfully"));
});

const removePostImage = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { postId, imageId } = req.params;

  const [post] = await db
    .select()
    .from(socialPosts)
    .where(
      and(eq(socialPosts.id, postId), eq(socialPosts.author, req.user._id))
    )
    .limit(1);

  if (!post) {
    throw new ApiError(404, "Post does not exist");
  }

  const [removedImage] = await db
    .select()
    .from(socialPostImages)
    .where(
      and(
        eq(socialPostImages.id, imageId),
        eq(socialPostImages.postId, postId)
      )
    )
    .limit(1);

  if (removedImage) {
    await db
      .delete(socialPostImages)
      .where(eq(socialPostImages.id, imageId));
    removeLocalFile(removedImage.localPath);
  }

  const aggregatedPost = await getHydratedPostById(db, postId, req.user._id);

  return res
    .status(200)
    .json(
      new ApiResponse(200, aggregatedPost, "Post image removed successfully")
    );
});

const getAllPosts = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { page = 1, limit = 10 } = req.query;
  const viewerId = req.user?._id;

  const posts = await aggregatePaginate({
    page,
    limit,
    customLabels: {
      totalDocs: "totalPosts",
      docs: "posts",
    },
    getTotalDocs: async () => {
      const [row] = await db.select({ value: count() }).from(socialPosts);
      return Number(row?.value ?? 0);
    },
    getDocs: async ({ limit: take, offset }) => {
      const rows = await db
        .select()
        .from(socialPosts)
        .limit(take)
        .offset(offset);
      return hydrateSocialPosts(db, rows, viewerId);
    },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, posts, "Posts fetched successfully"));
});

const getPostsByUsername = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { page = 1, limit = 10 } = req.query;
  const { username } = req.params;
  const viewerId = req.user?._id;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username.toLowerCase()))
    .limit(1);

  if (!user) {
    throw new ApiError(
      404,
      "User with username '" + username + "' does not exist"
    );
  }

  const authorFilter = eq(socialPosts.author, user.id);

  const posts = await aggregatePaginate({
    page,
    limit,
    customLabels: {
      totalDocs: "totalPosts",
      docs: "posts",
    },
    getTotalDocs: async () => {
      const [row] = await db
        .select({ value: count() })
        .from(socialPosts)
        .where(authorFilter);
      return Number(row?.value ?? 0);
    },
    getDocs: async ({ limit: take, offset }) => {
      const rows = await db
        .select()
        .from(socialPosts)
        .where(authorFilter)
        .limit(take)
        .offset(offset);
      return hydrateSocialPosts(db, rows, viewerId);
    },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, posts, "User's posts fetched successfully"));
});

const getMyPosts = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { page = 1, limit = 10 } = req.query;
  const authorFilter = eq(socialPosts.author, req.user._id);

  const posts = await aggregatePaginate({
    page,
    limit,
    customLabels: {
      totalDocs: "totalPosts",
      docs: "posts",
    },
    getTotalDocs: async () => {
      const [row] = await db
        .select({ value: count() })
        .from(socialPosts)
        .where(authorFilter);
      return Number(row?.value ?? 0);
    },
    getDocs: async ({ limit: take, offset }) => {
      const rows = await db
        .select()
        .from(socialPosts)
        .where(authorFilter)
        .limit(take)
        .offset(offset);
      return hydrateSocialPosts(db, rows, req.user._id);
    },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, posts, "My posts fetched successfully"));
});

const getBookMarkedPosts = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { page = 1, limit = 10 } = req.query;
  const bookmarkFilter = eq(socialBookmarks.bookmarkedBy, req.user._id);

  const posts = await aggregatePaginate({
    page,
    limit,
    customLabels: {
      totalDocs: "totalBookmarkedPosts",
      docs: "bookmarkedPosts",
    },
    getTotalDocs: async () => {
      const [row] = await db
        .select({ value: count() })
        .from(socialBookmarks)
        .where(bookmarkFilter);
      return Number(row?.value ?? 0);
    },
    getDocs: async ({ limit: take, offset }) => {
      const bookmarkRows = await db
        .select()
        .from(socialBookmarks)
        .where(bookmarkFilter)
        .limit(take)
        .offset(offset);

      const postIds = bookmarkRows
        .map((b) => b.postId)
        .filter(Boolean);

      if (!postIds.length) return [];

      const postRows = await db
        .select()
        .from(socialPosts)
        .where(inArray(socialPosts.id, postIds));

      const postById = new Map(postRows.map((p) => [p.id, p]));
      const ordered = postIds
        .map((id) => postById.get(id))
        .filter(Boolean);

      return hydrateSocialPosts(db, ordered, req.user._id);
    },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, posts, "Bookmarked posts fetched successfully"));
});

const getPostById = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { postId } = req.params;

  const post = await getHydratedPostById(db, postId, req.user?._id);

  if (!post) {
    throw new ApiError(404, "Post does not exist");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, post, "Post fetched successfully"));
});

const deletePost = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { postId } = req.params;

  const [post] = await db
    .select()
    .from(socialPosts)
    .where(
      and(eq(socialPosts.id, postId), eq(socialPosts.author, req.user._id))
    )
    .limit(1);

  if (!post) {
    throw new ApiError(404, "Post does not exist");
  }

  const postImages = await db
    .select()
    .from(socialPostImages)
    .where(eq(socialPostImages.postId, postId));

  await db.delete(socialPosts).where(eq(socialPosts.id, postId));

  postImages.map((image) => {
    removeLocalFile(image.localPath);
  });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Post deleted successfully"));
});

const getPostsByTag = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { page = 1, limit = 10 } = req.query;
  const { tag } = req.params;
  const viewerId = req.user?._id;
  const tagFilter = arrayContains(socialPosts.tags, [tag]);

  const posts = await aggregatePaginate({
    page,
    limit,
    customLabels: {
      totalDocs: "totalPosts",
      docs: "posts",
    },
    getTotalDocs: async () => {
      const [row] = await db
        .select({ value: count() })
        .from(socialPosts)
        .where(tagFilter);
      return Number(row?.value ?? 0);
    },
    getDocs: async ({ limit: take, offset }) => {
      const rows = await db
        .select()
        .from(socialPosts)
        .where(tagFilter)
        .limit(take)
        .offset(offset);
      return hydrateSocialPosts(db, rows, viewerId);
    },
  });

  return res
    .status(200)
    .json(
      new ApiResponse(200, posts, `Posts with tag #${tag} fetched successfully`)
    );
});

export {
  createPost,
  deletePost,
  getAllPosts,
  getBookMarkedPosts,
  getMyPosts,
  getPostById,
  getPostsByUsername,
  removePostImage,
  updatePost,
  getPostsByTag,
};
