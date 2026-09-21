import { filterObjectKeys, getPaginatedPayload } from "@/utils/helpers.js";
import { ApiError } from "@/utils/ApiError.js";
import { ApiResponse } from "@/utils/ApiResponse.js";
import { asyncHandler } from "@/utils/asyncHandler.js";
import {
  getPayloadByDocId,
  getRandomPayload,
  listPayloads,
} from "@/utils/publicJsonDb.js";

const COLLECTION = "products";

const getRandomProducts = asyncHandler(async (req, res) => {
  const page = +(req.query.page || 1);
  const limit = +(req.query.limit || 10);
  const query = req.query.query?.toLowerCase(); // search query
  const inc = req.query.inc?.split(","); // only include fields mentioned in this query

  const randomProductsJson = await listPayloads(COLLECTION);

  let randomProductsArray = query
    ? structuredClone(randomProductsJson).filter((product) => {
        return (
          product.title.toLowerCase().includes(query) ||
          product.description.toLowerCase().includes(query) ||
          product.category.toLowerCase().includes(query)
        );
      })
    : structuredClone(randomProductsJson);

  const paginatedProducts = getPaginatedPayload(
    randomProductsArray,
    page,
    limit
  );
  const updatedProducts = inc
    ? filterObjectKeys(inc, paginatedProducts.data)
    : paginatedProducts.data;

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        ...paginatedProducts,
        data: updatedProducts,
      },
      "Random products fetched successfully"
    )
  );
});

const getProductById = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const product = await getPayloadByDocId(COLLECTION, productId);
  if (!product) {
    throw new ApiError(404, "Product does not exist.");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, product, "Product fetched successfully"));
});

const getARandomProduct = asyncHandler(async (req, res) => {
  const product = await getRandomPayload(COLLECTION);
  if (!product) {
    throw new ApiError(404, "Product does not exist.");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        product,
        "Random product fetched successfully"
      )
    );
});

export { getRandomProducts, getARandomProduct, getProductById };
