import { and, desc, eq, ilike } from "drizzle-orm";
import { dbInstance } from "@/db/index.js";
import { todos } from "@/models/apps/todo/todo.models.js";
import { withId } from "@/models/serializers.js";
import { ApiError } from "@/utils/ApiError.js";
import { ApiResponse } from "@/utils/ApiResponse.js";
import { asyncHandler } from "@/utils/asyncHandler.js";

const requireDb = () => {
  if (!dbInstance) {
    throw new ApiError(500, "Database is not connected");
  }
  return dbInstance;
};

const getAllTodos = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { query, complete } = req.query;

  /** @type {import("drizzle-orm").SQL[]} */
  const filters = [];

  if (query?.length > 0) {
    // Title-only match (case-insensitive)
    filters.push(ilike(todos.title, `%${query.trim()}%`));
  }

  if (complete) {
    filters.push(eq(todos.isComplete, JSON.parse(complete)));
  }

  const rows = await db
    .select()
    .from(todos)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(todos.updatedAt));

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        rows.map((row) => withId(row)),
        "Todos fetched successfully"
      )
    );
});

const getTodoById = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { todoId } = req.params;

  const [todo] = await db
    .select()
    .from(todos)
    .where(eq(todos.id, todoId))
    .limit(1);

  if (!todo) {
    throw new ApiError(404, "Todo does not exist");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, withId(todo), "Todo fetched successfully"));
});

const createTodo = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { title, description } = req.body;

  const [todo] = await db
    .insert(todos)
    .values({
      title,
      description,
    })
    .returning();

  return res
    .status(201)
    .json(new ApiResponse(201, withId(todo), "Todo created successfully"));
});

const updateTodo = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { todoId } = req.params;
  const { title, description } = req.body;

  const [todo] = await db
    .update(todos)
    .set({
      title,
      description,
    })
    .where(eq(todos.id, todoId))
    .returning();

  if (!todo) {
    throw new ApiError(404, "Todo does not exist");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, withId(todo), "Todo updated successfully"));
});

const toggleTodoDoneStatus = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { todoId } = req.params;

  const [existing] = await db
    .select()
    .from(todos)
    .where(eq(todos.id, todoId))
    .limit(1);

  if (!existing) {
    throw new ApiError(404, "Todo does not exist");
  }

  const [todo] = await db
    .update(todos)
    .set({ isComplete: !existing.isComplete })
    .where(eq(todos.id, todoId))
    .returning();

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        withId(todo),
        `Todo marked ${todo.isComplete ? "done" : "undone"}`
      )
    );
});

const deleteTodo = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { todoId } = req.params;

  const [todo] = await db
    .delete(todos)
    .where(eq(todos.id, todoId))
    .returning();

  if (!todo) {
    throw new ApiError(404, "Todo does not exist");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { deletedTodo: withId(todo) },
        "Todo deleted successfully"
      )
    );
});

export {
  getAllTodos,
  getTodoById,
  createTodo,
  updateTodo,
  deleteTodo,
  toggleTodoDoneStatus,
};
