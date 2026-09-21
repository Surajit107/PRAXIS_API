import { filterObjectKeys, getPaginatedPayload } from "@/utils/helpers.js";
import { ApiError } from "@/utils/ApiError.js";
import { ApiResponse } from "@/utils/ApiResponse.js";
import { asyncHandler } from "@/utils/asyncHandler.js";
import {
  getPayloadByDocId,
  getRandomPayload,
  listPayloads,
} from "@/utils/publicJsonDb.js";

const COLLECTION = "transactions";

const getTransactions = asyncHandler(async (req, res) => {
  const page = +(req.query.page || 1);
  const limit = +(req.query.limit || 10);
  const query = req.query.query?.toLowerCase(); // search query
  const inc = req.query.inc?.split(","); // only include fields mentioned in this query

  const transactionsJson = await listPayloads(COLLECTION);

  let transactionsArray = query
    ? structuredClone(transactionsJson).filter((transaction) => {
        return (
          String(transaction.id || "")
            .toLowerCase()
            .includes(query) ||
          transaction.type?.toLowerCase().includes(query) ||
          transaction.status?.toLowerCase().includes(query) ||
          transaction.provider?.toLowerCase().includes(query) ||
          transaction.providerReference?.toLowerCase().includes(query)
        );
      })
    : structuredClone(transactionsJson);

  const paginatedTransactions = getPaginatedPayload(transactionsArray, page, limit);
  const updatedTransactions = inc
    ? filterObjectKeys(inc, paginatedTransactions.data)
    : paginatedTransactions.data;
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        ...paginatedTransactions,
        data: updatedTransactions,
      },
      "Transactions fetched successfully"
    )
  );
});

const getTransactionById = asyncHandler(async (req, res) => {
  const { transactionId } = req.params;
  const transaction = await getPayloadByDocId(COLLECTION, transactionId);
  if (!transaction) {
    throw new ApiError(404, "Transaction does not exist.");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, transaction, "Transaction fetched successfully"));
});

const getARandomTransaction = asyncHandler(async (req, res) => {
  const transaction = await getRandomPayload(COLLECTION);
  if (!transaction) {
    throw new ApiError(404, "Transaction does not exist.");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, transaction, "Transaction fetched successfully"));
});

export { getTransactions, getARandomTransaction, getTransactionById };
