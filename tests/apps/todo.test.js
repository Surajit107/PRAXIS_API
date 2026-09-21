import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import { getTestAgent } from "../helpers/app.js";
import { clearDb } from "../helpers/db.js";

describe("Todo App", () => {
  /** @type {import("supertest").SuperTest<import("supertest").Test>} */
  let agent;
  /** @type {string | null} */
  let todoId = null;

  beforeAll(async () => {
    agent = await getTestAgent();
    await clearDb();
  });

  afterAll(async () => {
    await clearDb();
  });

  describe("GET /api/v1/todos - Get All Todos", () => {
    test("should return empty list initially", async () => {
      const res = await agent.get("/api/v1/todos");
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  describe("POST /api/v1/todos - Create Todo", () => {
    test("should create todo with valid data", async () => {
      const todo = {
        title: "test-todo-title",
        description: "test-todo-description",
      };
      const res = await agent.post("/api/v1/todos").send(todo);
      expect(res.status).toBe(201);
      expect(res.body.statusCode).toBe(201);
      expect(res.body.data).toMatchObject(todo);
      expect(res.body.data._id).toBeDefined();
      expect(res.body.data.isComplete).toBe(false);
      todoId = res.body.data._id;
    });

    test("should return 422 when title is missing", async () => {
      const res = await agent.post("/api/v1/todos").send({});
      expect(res.status).toBe(422);
      expect(res.body.statusCode).toBe(422);
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ title: expect.anything() }),
        ])
      );
    });

    test("should return 422 when title and description are empty", async () => {
      const res = await agent
        .post("/api/v1/todos")
        .send({ title: "", description: "" });
      expect(res.status).toBe(422);
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ title: expect.anything() }),
          expect.objectContaining({ description: expect.anything() }),
        ])
      );
    });
  });

  describe("PATCH /api/v1/todos/:todoId - Update Todo", () => {
    const todo = {
      title: "update-test-todo-title",
      description: "update-test-todo-description",
    };

    test("should update todo with valid data", async () => {
      const res = await agent.patch(`/api/v1/todos/${todoId}`).send(todo);
      expect(res.status).toBe(200);
      expect(res.body.statusCode).toBe(200);
      expect(res.body.data).toMatchObject(todo);
    });

    test("should return 422 when title and description are empty", async () => {
      const res = await agent
        .patch(`/api/v1/todos/${todoId}`)
        .send({ title: "", description: "" });
      expect(res.status).toBe(422);
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ title: expect.anything() }),
          expect.objectContaining({ description: expect.anything() }),
        ])
      );
    });
  });

  describe("PATCH /api/v1/todos/toggle/status/:todoId", () => {
    test("should toggle todo status", async () => {
      const res = await agent.patch(
        `/api/v1/todos/toggle/status/${todoId}`
      );
      expect(res.status).toBe(200);
      expect(res.body.statusCode).toBe(200);
      expect(res.body.data.isComplete).toBe(true);
    });
  });

  describe("GET /api/v1/todos/:todoId", () => {
    test("should return todo when valid id passed", async () => {
      const res = await agent.get(`/api/v1/todos/${todoId}`);
      expect(res.status).toBe(200);
      expect(res.body.statusCode).toBe(200);
      expect(res.body.data._id).toBe(todoId);
    });

    test("should return 422 when invalid id passed", async () => {
      const res = await agent.get("/api/v1/todos/__1");
      expect(res.status).toBe(422);
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ todoId: expect.anything() }),
        ])
      );
    });
  });

  describe("GET /api/v1/todos filters", () => {
    test("should filter by query title substring", async () => {
      const res = await agent.get("/api/v1/todos").query({
        query: "update-test",
      });
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].title).toMatch(/update-test/i);
    });

    test("should filter by complete=true", async () => {
      const res = await agent.get("/api/v1/todos").query({ complete: "true" });
      expect(res.status).toBe(200);
      expect(res.body.data.every((t) => t.isComplete === true)).toBe(true);
    });
  });

  describe("DELETE /api/v1/todos/:todoId", () => {
    test("should delete todo", async () => {
      const res = await agent.delete(`/api/v1/todos/${todoId}`);
      expect(res.status).toBe(200);
      expect(res.body.statusCode).toBe(200);
      expect(res.body.data.deletedTodo._id).toBe(todoId);
    });
  });
});
