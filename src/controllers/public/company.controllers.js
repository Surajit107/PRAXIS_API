import { filterObjectKeys, getPaginatedPayload } from "@/utils/helpers.js";
import { ApiError } from "@/utils/ApiError.js";
import { ApiResponse } from "@/utils/ApiResponse.js";
import { asyncHandler } from "@/utils/asyncHandler.js";
import {
  getPayloadByDocId,
  getRandomPayload,
  listPayloads,
} from "@/utils/publicJsonDb.js";

const COLLECTION = "companies";

const getCompanies = asyncHandler(async (req, res) => {
  const page = +(req.query.page || 1);
  const limit = +(req.query.limit || 10);
  const query = req.query.query?.toLowerCase(); // search query
  const inc = req.query.inc?.split(","); // only include fields mentioned in this query

  const companiesJson = await listPayloads(COLLECTION);

  let companiesArray = query
    ? structuredClone(companiesJson).filter((company) => {
        return (
          company.name?.toLowerCase().includes(query) ||
          company.legalName?.toLowerCase().includes(query) ||
          company.industry?.toLowerCase().includes(query) ||
          company.email?.toLowerCase().includes(query)
        );
      })
    : structuredClone(companiesJson);

  const paginatedCompanies = getPaginatedPayload(companiesArray, page, limit);
  const updatedCompanies = inc
    ? filterObjectKeys(inc, paginatedCompanies.data)
    : paginatedCompanies.data;
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        ...paginatedCompanies,
        data: updatedCompanies,
      },
      "Companies fetched successfully"
    )
  );
});

const getCompanyById = asyncHandler(async (req, res) => {
  const { companyId } = req.params;
  const company = await getPayloadByDocId(COLLECTION, companyId);
  if (!company) {
    throw new ApiError(404, "Company does not exist.");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, company, "Company fetched successfully"));
});

const getARandomCompany = asyncHandler(async (req, res) => {
  const company = await getRandomPayload(COLLECTION);
  if (!company) {
    throw new ApiError(404, "Company does not exist.");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, company, "Company fetched successfully"));
});

export { getCompanies, getARandomCompany, getCompanyById };
