import { filterObjectKeys, getPaginatedPayload } from "@/utils/helpers.js";
import { ApiError } from "@/utils/ApiError.js";
import { ApiResponse } from "@/utils/ApiResponse.js";
import { asyncHandler } from "@/utils/asyncHandler.js";
import {
  getPayloadByDocId,
  getRandomPayload,
  listPayloads,
} from "@/utils/publicJsonDb.js";

const COLLECTION = "inventory";

const getInventory = asyncHandler(async (req, res) => {
  const page = +(req.query.page || 1);
  const limit = +(req.query.limit || 10);
  const query = req.query.query?.toLowerCase(); // search query
  const inc = req.query.inc?.split(","); // only include fields mentioned in this query

  const inventoryJson = await listPayloads(COLLECTION);

  let inventoryArray = query
    ? structuredClone(inventoryJson).filter((item) => {
        return (
          item.sku?.toLowerCase().includes(query) ||
          item.name?.toLowerCase().includes(query) ||
          item.brand?.toLowerCase().includes(query) ||
          item.category?.toLowerCase().includes(query) ||
          item.status?.toLowerCase().includes(query)
        );
      })
    : structuredClone(inventoryJson);

  const paginatedInventory = getPaginatedPayload(inventoryArray, page, limit);
  const updatedInventory = inc
    ? filterObjectKeys(inc, paginatedInventory.data)
    : paginatedInventory.data;
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        ...paginatedInventory,
        data: updatedInventory,
      },
      "Inventory fetched successfully"
    )
  );
});

const getInventoryById = asyncHandler(async (req, res) => {
  const { inventoryId } = req.params;
  const item = await getPayloadByDocId(COLLECTION, inventoryId);
  if (!item) {
    throw new ApiError(404, "Inventory item does not exist.");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, item, "Inventory item fetched successfully"));
});

const getARandomInventory = asyncHandler(async (req, res) => {
  const item = await getRandomPayload(COLLECTION);
  if (!item) {
    throw new ApiError(404, "Inventory item does not exist.");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, item, "Inventory item fetched successfully"));
});

export { getInventory, getARandomInventory, getInventoryById };
