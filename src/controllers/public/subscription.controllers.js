import { filterObjectKeys, getPaginatedPayload } from "@/utils/helpers.js";
import { ApiError } from "@/utils/ApiError.js";
import { ApiResponse } from "@/utils/ApiResponse.js";
import { asyncHandler } from "@/utils/asyncHandler.js";
import {
  getPayloadByDocId,
  getRandomPayload,
  listPayloads,
} from "@/utils/publicJsonDb.js";

const COLLECTION = "subscriptions";

const getSubscriptions = asyncHandler(async (req, res) => {
  const page = +(req.query.page || 1);
  const limit = +(req.query.limit || 10);
  const query = req.query.query?.toLowerCase(); // search query
  const inc = req.query.inc?.split(","); // only include fields mentioned in this query

  const subscriptionsJson = await listPayloads(COLLECTION);

  let subscriptionsArray = query
    ? structuredClone(subscriptionsJson).filter((subscription) => {
        return (
          subscription.status?.toLowerCase().includes(query) ||
          subscription.plan?.name?.toLowerCase().includes(query) ||
          subscription.customer?.name?.toLowerCase().includes(query) ||
          subscription.customer?.email?.toLowerCase().includes(query)
        );
      })
    : structuredClone(subscriptionsJson);

  const paginatedSubscriptions = getPaginatedPayload(subscriptionsArray, page, limit);
  const updatedSubscriptions = inc
    ? filterObjectKeys(inc, paginatedSubscriptions.data)
    : paginatedSubscriptions.data;
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        ...paginatedSubscriptions,
        data: updatedSubscriptions,
      },
      "Subscriptions fetched successfully"
    )
  );
});

const getSubscriptionById = asyncHandler(async (req, res) => {
  const { subscriptionId } = req.params;
  const subscription = await getPayloadByDocId(COLLECTION, subscriptionId);
  if (!subscription) {
    throw new ApiError(404, "Subscription does not exist.");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, subscription, "Subscription fetched successfully"));
});

const getARandomSubscription = asyncHandler(async (req, res) => {
  const subscription = await getRandomPayload(COLLECTION);
  if (!subscription) {
    throw new ApiError(404, "Subscription does not exist.");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, subscription, "Subscription fetched successfully"));
});

export { getSubscriptions, getARandomSubscription, getSubscriptionById };
