import { filterObjectKeys, getPaginatedPayload } from "@/utils/helpers.js";
import { ApiError } from "@/utils/ApiError.js";
import { ApiResponse } from "@/utils/ApiResponse.js";
import { asyncHandler } from "@/utils/asyncHandler.js";
import {
  getPayloadByDocId,
  getRandomPayload,
  listPayloads,
} from "@/utils/publicJsonDb.js";

const COLLECTION = "employees";

const getEmployees = asyncHandler(async (req, res) => {
  const page = +(req.query.page || 1);
  const limit = +(req.query.limit || 10);
  const query = req.query.query?.toLowerCase(); // search query
  const inc = req.query.inc?.split(","); // only include fields mentioned in this query

  const employeesJson = await listPayloads(COLLECTION);

  let employeesArray = query
    ? structuredClone(employeesJson).filter((employee) => {
        return (
          employee.firstName?.toLowerCase().includes(query) ||
          employee.lastName?.toLowerCase().includes(query) ||
          employee.displayName?.toLowerCase().includes(query) ||
          employee.email?.toLowerCase().includes(query) ||
          employee.jobTitle?.toLowerCase().includes(query) ||
          employee.department?.toLowerCase().includes(query)
        );
      })
    : structuredClone(employeesJson);

  const paginatedEmployees = getPaginatedPayload(employeesArray, page, limit);
  const updatedEmployees = inc
    ? filterObjectKeys(inc, paginatedEmployees.data)
    : paginatedEmployees.data;
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        ...paginatedEmployees,
        data: updatedEmployees,
      },
      "Employees fetched successfully"
    )
  );
});

const getEmployeeById = asyncHandler(async (req, res) => {
  const { employeeId } = req.params;
  const employee = await getPayloadByDocId(COLLECTION, employeeId);
  if (!employee) {
    throw new ApiError(404, "Employee does not exist.");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, employee, "Employee fetched successfully"));
});

const getARandomEmployee = asyncHandler(async (req, res) => {
  const employee = await getRandomPayload(COLLECTION);
  if (!employee) {
    throw new ApiError(404, "Employee does not exist.");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, employee, "Employee fetched successfully"));
});

export { getEmployees, getARandomEmployee, getEmployeeById };
