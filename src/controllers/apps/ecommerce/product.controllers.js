import { and, count, eq, inArray } from "drizzle-orm";
import { MAXIMUM_SUB_IMAGE_COUNT } from "@/constants.js";
import { dbInstance } from "@/db/index.js";
import { categories } from "@/models/apps/ecommerce/category.models.js";
import {
  productSubImages,
  products,
} from "@/models/apps/ecommerce/product.models.js";
import { shapeProduct, withId } from "@/models/serializers.js";
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
 * Load sub-images for many products and return a Map<productId, rows[]>.
 * @param {import("drizzle-orm/postgres-js").PostgresJsDatabase} db
 * @param {string[]} productIds
 */
export const loadSubImagesByProductIds = async (db, productIds) => {
  /** @type {Map<string, typeof productSubImages.$inferSelect[]>} */
  const map = new Map();
  if (!productIds.length) return map;

  const rows = await db
    .select()
    .from(productSubImages)
    .where(inArray(productSubImages.productId, productIds));

  for (const row of rows) {
    const list = map.get(row.productId) ?? [];
    list.push(row);
    map.set(row.productId, list);
  }
  return map;
};

/**
 * @param {import("drizzle-orm/postgres-js").PostgresJsDatabase} db
 * @param {string} productId
 */
export const getShapedProductById = async (db, productId) => {
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!product) return null;

  const subImages = await db
    .select()
    .from(productSubImages)
    .where(eq(productSubImages.productId, productId));

  return shapeProduct(product, subImages);
};

/**
 * @param {import("drizzle-orm/postgres-js").PostgresJsDatabase} db
 * @param {typeof products.$inferSelect[]} rows
 */
export const shapeProductRows = async (db, rows) => {
  const subMap = await loadSubImagesByProductIds(
    db,
    rows.map((row) => row.id)
  );
  return rows.map((row) => shapeProduct(row, subMap.get(row.id) ?? []));
};

const getAllProducts = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { page = 1, limit = 10 } = req.query;

  const result = await aggregatePaginate({
    page,
    limit,
    customLabels: {
      totalDocs: "totalProducts",
      docs: "products",
    },
    getTotalDocs: async () => {
      const [row] = await db.select({ value: count() }).from(products);
      return Number(row?.value ?? 0);
    },
    getDocs: async ({ limit: take, offset }) => {
      const rows = await db.select().from(products).limit(take).offset(offset);
      return shapeProductRows(db, rows);
    },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, result, "Products fetched successfully"));
});

const createProduct = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { name, description, category, price, stock } = req.body;

  const [categoryToBeAdded] = await db
    .select()
    .from(categories)
    .where(eq(categories.id, category))
    .limit(1);

  if (!categoryToBeAdded) {
    throw new ApiError(404, "Category does not exist");
  }

  if (!req.files?.mainImage || !req.files?.mainImage.length) {
    throw new ApiError(400, "Main image is required");
  }

  const mainImageUrl = getStaticFilePath(
    req,
    req.files?.mainImage[0]?.filename
  );
  const mainImageLocalPath = getLocalPath(req.files?.mainImage[0]?.filename);

  /** @type {{ url: string; localPath: string }[]} */
  const subImagePayload =
    req.files.subImages && req.files.subImages?.length
      ? req.files.subImages.map((image) => {
          const imageUrl = getStaticFilePath(req, image.filename);
          const imageLocalPath = getLocalPath(image.filename);
          return { url: imageUrl, localPath: imageLocalPath };
        })
      : [];

  const owner = req.user._id;

  const product = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(products)
      .values({
        name,
        description,
        stock: Number(stock),
        price: Number(price),
        owner,
        mainImageUrl,
        mainImageLocalPath,
        category,
      })
      .returning();

    if (subImagePayload.length > 0) {
      await tx.insert(productSubImages).values(
        subImagePayload.map((img) => ({
          productId: created.id,
          url: img.url,
          localPath: img.localPath,
        }))
      );
    }

    return created;
  });

  const shaped = await getShapedProductById(db, product.id);

  return res
    .status(201)
    .json(new ApiResponse(201, shaped, "Product created successfully"));
});

const updateProduct = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { productId } = req.params;
  const { name, description, category, price, stock } = req.body;

  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!product) {
    throw new ApiError(404, "Product does not exist");
  }

  const existingSubImages = await db
    .select()
    .from(productSubImages)
    .where(eq(productSubImages.productId, productId));

  const newMainImage = req.files?.mainImage?.length
    ? {
        url: getStaticFilePath(req, req.files?.mainImage[0]?.filename),
        localPath: getLocalPath(req.files?.mainImage[0]?.filename),
      }
    : null;

  /** @type {{ url: string; localPath: string }[]} */
  let newSubImages =
    req.files?.subImages && req.files.subImages?.length
      ? req.files.subImages.map((image) => {
          const imageUrl = getStaticFilePath(req, image.filename);
          const imageLocalPath = getLocalPath(image.filename);
          return { url: imageUrl, localPath: imageLocalPath };
        })
      : [];

  const existedSubImages = existingSubImages.length;
  const totalSubImages = existedSubImages + newSubImages.length;

  if (totalSubImages > MAXIMUM_SUB_IMAGE_COUNT) {
    newSubImages?.map((img) => removeLocalFile(img.localPath));
    if (newMainImage) {
      removeLocalFile(newMainImage.localPath);
    }
    throw new ApiError(
      400,
      "Maximum " +
        MAXIMUM_SUB_IMAGE_COUNT +
        " sub images are allowed for a product. There are already " +
        existedSubImages +
        " sub images attached to the product."
    );
  }

  const [updatedProduct] = await db
    .update(products)
    .set({
      name,
      description,
      stock: Number(stock),
      price: Number(price),
      category,
      ...(newMainImage
        ? {
            mainImageUrl: newMainImage.url,
            mainImageLocalPath: newMainImage.localPath,
          }
        : {}),
    })
    .where(eq(products.id, productId))
    .returning();

  if (newSubImages.length > 0) {
    await db.insert(productSubImages).values(
      newSubImages.map((img) => ({
        productId,
        url: img.url,
        localPath: img.localPath,
      }))
    );
  }

  if (newMainImage) {
    removeLocalFile(product.mainImageLocalPath);
  }

  const shaped = await getShapedProductById(db, updatedProduct.id);

  return res
    .status(200)
    .json(new ApiResponse(200, shaped, "Product updated successfully"));
});

const getProductById = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { productId } = req.params;
  const product = await getShapedProductById(db, productId);

  if (!product) {
    throw new ApiError(404, "Product does not exist");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, product, "Product fetched successfully"));
});

const getProductsByCategory = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { categoryId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  const [category] = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.id, categoryId))
    .limit(1);

  if (!category) {
    throw new ApiError(404, "Category does not exist");
  }

  const categoryFilter = eq(products.category, categoryId);

  const result = await aggregatePaginate({
    page,
    limit,
    customLabels: {
      totalDocs: "totalProducts",
      docs: "products",
    },
    getTotalDocs: async () => {
      const [row] = await db
        .select({ value: count() })
        .from(products)
        .where(categoryFilter);
      return Number(row?.value ?? 0);
    },
    getDocs: async ({ limit: take, offset }) => {
      const rows = await db
        .select()
        .from(products)
        .where(categoryFilter)
        .limit(take)
        .offset(offset);
      return shapeProductRows(db, rows);
    },
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      { ...result, category: withId(category) },
      "Category products fetched successfully"
    )
  );
});

const removeProductSubImage = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { productId, subImageId } = req.params;

  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!product) {
    throw new ApiError(404, "Product does not exist");
  }

  const [removedSubImage] = await db
    .delete(productSubImages)
    .where(
      and(
        eq(productSubImages.id, subImageId),
        eq(productSubImages.productId, productId)
      )
    )
    .returning();

  if (removedSubImage) {
    removeLocalFile(removedSubImage.localPath);
  }

  const shaped = await getShapedProductById(db, productId);

  return res
    .status(200)
    .json(new ApiResponse(200, shaped, "Sub image removed successfully"));
});

const deleteProduct = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { productId } = req.params;

  const shaped = await getShapedProductById(db, productId);
  if (!shaped) {
    throw new ApiError(404, "Product does not exist");
  }

  const [deleted] = await db
    .delete(products)
    .where(eq(products.id, productId))
    .returning();

  if (!deleted) {
    throw new ApiError(404, "Product does not exist");
  }

  const productImages = [
    { localPath: deleted.mainImageLocalPath },
    ...(shaped.subImages ?? []),
  ];

  productImages.map((image) => {
    removeLocalFile(image.localPath);
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      { deletedProduct: shaped },
      "Product deleted successfully"
    )
  );
});

export {
  createProduct,
  deleteProduct,
  getAllProducts,
  getProductById,
  getProductsByCategory,
  updateProduct,
  removeProductSubImage,
};
