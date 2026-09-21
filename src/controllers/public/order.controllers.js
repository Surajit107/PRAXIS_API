import { filterObjectKeys, getPaginatedPayload } from "@/utils/helpers.js";
import { ApiError } from "@/utils/ApiError.js";
import { ApiResponse } from "@/utils/ApiResponse.js";
import { asyncHandler } from "@/utils/asyncHandler.js";
import {
  getPayloadByDocId,
  getRandomPayload,
  listPayloads,
} from "@/utils/publicJsonDb.js";

const COLLECTION = "orders";

const getPublicOrders = asyncHandler(async (req, res) => {
  const page = +(req.query.page || 1);
  const limit = +(req.query.limit || 10);
  const query = req.query.query?.toLowerCase(); // search query
  const inc = req.query.inc?.split(","); // only include fields mentioned in this query

  const ordersJson = await listPayloads(COLLECTION);

  let ordersArray = query
    ? structuredClone(ordersJson).filter((order) => {
        return (
          order.number?.toLowerCase().includes(query) ||
          order.status?.toLowerCase().includes(query) ||
          order.customer?.name?.toLowerCase().includes(query) ||
          order.customer?.email?.toLowerCase().includes(query)
        );
      })
    : structuredClone(ordersJson);

  const paginatedOrders = getPaginatedPayload(ordersArray, page, limit);
  const updatedOrders = inc
    ? filterObjectKeys(inc, paginatedOrders.data)
    : paginatedOrders.data;
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        ...paginatedOrders,
        data: updatedOrders,
      },
      "Orders fetched successfully"
    )
  );
});

const getPublicOrderById = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const order = await getPayloadByDocId(COLLECTION, orderId);
  if (!order) {
    throw new ApiError(404, "Order does not exist.");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, order, "Order fetched successfully"));
});

const getARandomPublicOrder = asyncHandler(async (req, res) => {
  const order = await getRandomPayload(COLLECTION);
  if (!order) {
    throw new ApiError(404, "Order does not exist.");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, order, "Order fetched successfully"));
});

export { getPublicOrders, getARandomPublicOrder, getPublicOrderById };
