import { filterObjectKeys, getPaginatedPayload } from "@/utils/helpers.js";
import { ApiError } from "@/utils/ApiError.js";
import { ApiResponse } from "@/utils/ApiResponse.js";
import { asyncHandler } from "@/utils/asyncHandler.js";
import {
  getPayloadByDocId,
  getRandomPayload,
  listPayloads,
} from "@/utils/publicJsonDb.js";

const COLLECTION = "projects";

const getProjects = asyncHandler(async (req, res) => {
  const page = +(req.query.page || 1);
  const limit = +(req.query.limit || 10);
  const query = req.query.query?.toLowerCase(); // search query
  const inc = req.query.inc?.split(","); // only include fields mentioned in this query

  const projectsJson = await listPayloads(COLLECTION);

  let projectsArray = query
    ? structuredClone(projectsJson).filter((project) => {
        return (
          project.key?.toLowerCase().includes(query) ||
          project.name?.toLowerCase().includes(query) ||
          project.status?.toLowerCase().includes(query) ||
          project.owner?.name?.toLowerCase().includes(query)
        );
      })
    : structuredClone(projectsJson);

  const paginatedProjects = getPaginatedPayload(projectsArray, page, limit);
  const updatedProjects = inc
    ? filterObjectKeys(inc, paginatedProjects.data)
    : paginatedProjects.data;
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        ...paginatedProjects,
        data: updatedProjects,
      },
      "Projects fetched successfully"
    )
  );
});

const getProjectById = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const project = await getPayloadByDocId(COLLECTION, projectId);
  if (!project) {
    throw new ApiError(404, "Project does not exist.");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, project, "Project fetched successfully"));
});

const getARandomProject = asyncHandler(async (req, res) => {
  const project = await getRandomPayload(COLLECTION);
  if (!project) {
    throw new ApiError(404, "Project does not exist.");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, project, "Project fetched successfully"));
});

export { getProjects, getARandomProject, getProjectById };
