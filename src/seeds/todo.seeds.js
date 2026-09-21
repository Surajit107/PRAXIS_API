import { faker } from "@faker-js/faker";
import { dbInstance } from "@/db/index.js";
import { todos } from "@/models/apps/todo/todo.models.js";
import { ApiError } from "@/utils/ApiError.js";
import { ApiResponse } from "@/utils/ApiResponse.js";
import { asyncHandler } from "@/utils/asyncHandler.js";
import { TODOS_COUNT } from "@/seeds/_constants.js";

const todoBlueprints = new Array(TODOS_COUNT).fill("_").map(() => ({
  title: faker.lorem.sentence({ min: 3, max: 5 }),
  description: faker.lorem.paragraph({
    min: 10,
    max: 15,
  }),
  isComplete: faker.datatype.boolean({}),
}));

const seedTodos = asyncHandler(async (req, res) => {
  if (!dbInstance) {
    throw new ApiError(500, "Database is not connected");
  }

  await dbInstance.delete(todos);
  await dbInstance.insert(todos).values(todoBlueprints);

  return res
    .status(201)
    .json(new ApiResponse(201, {}, "Todos inserted successfully"));
});

export { seedTodos };
