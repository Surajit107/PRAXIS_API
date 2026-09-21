import { count, eq } from "drizzle-orm";
import { dbInstance } from "@/db/index.js";
import { categories } from "@/models/apps/ecommerce/category.models.js";
import { withId } from "@/models/serializers.js";
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

const createCategory = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { name } = req.body;

  const [category] = await db
    .insert(categories)
    .values({ name, owner: req.user._id })
    .returning();

  return res
    .status(201)
    .json(
      new ApiResponse(200, withId(category), "Category created successfully")
    );
});

const getAllCategories = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { page = 1, limit = 10 } = req.query;

  const result = await aggregatePaginate({
    page,
    limit,
    customLabels: {
      totalDocs: "totalCategories",
      docs: "categories",
    },
    getTotalDocs: async () => {
      const [row] = await db.select({ value: count() }).from(categories);
      return Number(row?.value ?? 0);
    },
    getDocs: async ({ limit: take, offset }) => {
      const rows = await db
        .select()
        .from(categories)
        .limit(take)
        .offset(offset);
      return rows.map(withId);
    },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, result, "Categories fetched successfully"));
});

const getCategoryById = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { categoryId } = req.params;

  const [category] = await db
    .select()
    .from(categories)
    .where(eq(categories.id, categoryId))
    .limit(1);

  if (!category) {
    throw new ApiError(404, "Category does not exist");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, withId(category), "Category fetched successfully")
    );
});

const updateCategory = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { categoryId } = req.params;
  const { name } = req.body;

  const [category] = await db
    .update(categories)
    .set({ name })
    .where(eq(categories.id, categoryId))
    .returning();

  if (!category) {
    throw new ApiError(404, "Category does not exist");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, withId(category), "Category updated successfully")
    );
});

const deleteCategory = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { categoryId } = req.params;

  const [category] = await db
    .delete(categories)
    .where(eq(categories.id, categoryId))
    .returning();

  if (!category) {
    throw new ApiError(404, "Category does not exist");
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      { deletedCategory: withId(category) },
      "Category deleted successfully"
    )
  );
});

export {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
};
