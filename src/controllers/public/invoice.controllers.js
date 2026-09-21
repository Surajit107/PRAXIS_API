import { filterObjectKeys, getPaginatedPayload } from "@/utils/helpers.js";
import { ApiError } from "@/utils/ApiError.js";
import { ApiResponse } from "@/utils/ApiResponse.js";
import { asyncHandler } from "@/utils/asyncHandler.js";
import {
  getPayloadByDocId,
  getRandomPayload,
  listPayloads,
} from "@/utils/publicJsonDb.js";

const COLLECTION = "invoices";

const getInvoices = asyncHandler(async (req, res) => {
  const page = +(req.query.page || 1);
  const limit = +(req.query.limit || 10);
  const query = req.query.query?.toLowerCase(); // search query
  const inc = req.query.inc?.split(","); // only include fields mentioned in this query

  const invoicesJson = await listPayloads(COLLECTION);

  let invoicesArray = query
    ? structuredClone(invoicesJson).filter((invoice) => {
        return (
          invoice.number?.toLowerCase().includes(query) ||
          invoice.status?.toLowerCase().includes(query) ||
          invoice.customer?.name?.toLowerCase().includes(query) ||
          invoice.customer?.email?.toLowerCase().includes(query)
        );
      })
    : structuredClone(invoicesJson);

  const paginatedInvoices = getPaginatedPayload(invoicesArray, page, limit);
  const updatedInvoices = inc
    ? filterObjectKeys(inc, paginatedInvoices.data)
    : paginatedInvoices.data;
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        ...paginatedInvoices,
        data: updatedInvoices,
      },
      "Invoices fetched successfully"
    )
  );
});

const getInvoiceById = asyncHandler(async (req, res) => {
  const { invoiceId } = req.params;
  const invoice = await getPayloadByDocId(COLLECTION, invoiceId);
  if (!invoice) {
    throw new ApiError(404, "Invoice does not exist.");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, invoice, "Invoice fetched successfully"));
});

const getARandomInvoice = asyncHandler(async (req, res) => {
  const invoice = await getRandomPayload(COLLECTION);
  if (!invoice) {
    throw new ApiError(404, "Invoice does not exist.");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, invoice, "Invoice fetched successfully"));
});

export { getInvoices, getARandomInvoice, getInvoiceById };
