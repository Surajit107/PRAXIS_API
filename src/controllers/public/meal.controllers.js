import { filterObjectKeys, getPaginatedPayload } from "@/utils/helpers.js";
import { ApiError } from "@/utils/ApiError.js";
import { ApiResponse } from "@/utils/ApiResponse.js";
import { asyncHandler } from "@/utils/asyncHandler.js";
import {
  getPayloadByDocId,
  getRandomPayload,
  listPayloads,
} from "@/utils/publicJsonDb.js";

const COLLECTION = "meals";

const getMeals = asyncHandler(async (req, res) => {
  const page = +(req.query.page || 1);
  const limit = +(req.query.limit || 10);
  const query = req.query.query?.toLowerCase(); // search query
  const inc = req.query.inc?.split(","); // only include fields mentioned in this query

  const mealsJson = await listPayloads(COLLECTION);

  let mealsArray = query
    ? structuredClone(mealsJson).filter((meal) => {
        return (
          meal.strMeal?.toLowerCase().includes(query) ||
          meal.strCategory?.includes(query)
        );
      })
    : structuredClone(mealsJson);

  const paginatedMeals = getPaginatedPayload(mealsArray, page, limit);
  const updatedMeals = inc
    ? filterObjectKeys(inc, paginatedMeals.data)
    : paginatedMeals.data;
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        ...paginatedMeals,
        data: updatedMeals,
      },
      "Meals fetched successfully"
    )
  );
});

const getMealById = asyncHandler(async (req, res) => {
  const { mealId } = req.params;
  const meal = await getPayloadByDocId(COLLECTION, mealId);
  if (!meal) {
    throw new ApiError(404, "Meal does not exist.");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, meal, "Meal fetched successfully"));
});

const getARandomMeal = asyncHandler(async (req, res) => {
  const meal = await getRandomPayload(COLLECTION);
  if (!meal) {
    throw new ApiError(404, "Meal does not exist.");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, meal, "Meal fetched successfully"));
});

export { getMeals, getARandomMeal, getMealById };
