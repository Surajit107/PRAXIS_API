import { filterObjectKeys, getPaginatedPayload } from "@/utils/helpers.js";
import { ApiError } from "@/utils/ApiError.js";
import { ApiResponse } from "@/utils/ApiResponse.js";
import { asyncHandler } from "@/utils/asyncHandler.js";
import {
  getPayloadByDocId,
  getRandomPayload,
  listPayloads,
} from "@/utils/publicJsonDb.js";

const COLLECTION = "customers";

const getCustomers = asyncHandler(async (req, res) => {
  const page = +(req.query.page || 1);
  const limit = +(req.query.limit || 10);
  const query = req.query.query?.toLowerCase(); // search query
  const inc = req.query.inc?.split(","); // only include fields mentioned in this query

  const customersJson = await listPayloads(COLLECTION);

  let customersArray = query
    ? structuredClone(customersJson).filter((customer) => {
        return (
          customer.name?.toLowerCase().includes(query) ||
          customer.email?.toLowerCase().includes(query) ||
          customer.companyName?.toLowerCase().includes(query)
        );
      })
    : structuredClone(customersJson);

  const paginatedCustomers = getPaginatedPayload(customersArray, page, limit);
  const updatedCustomers = inc
    ? filterObjectKeys(inc, paginatedCustomers.data)
    : paginatedCustomers.data;
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        ...paginatedCustomers,
        data: updatedCustomers,
      },
      "Customers fetched successfully"
    )
  );
});

const getCustomerById = asyncHandler(async (req, res) => {
  const { customerId } = req.params;
  const customer = await getPayloadByDocId(COLLECTION, customerId);
  if (!customer) {
    throw new ApiError(404, "Customer does not exist.");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, customer, "Customer fetched successfully"));
});

const getARandomCustomer = asyncHandler(async (req, res) => {
  const customer = await getRandomPayload(COLLECTION);
  if (!customer) {
    throw new ApiError(404, "Customer does not exist.");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, customer, "Customer fetched successfully"));
});

export { getCustomers, getARandomCustomer, getCustomerById };
