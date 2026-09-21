import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import { randomUUID } from "crypto";
import express from "express";
import request from "supertest";
import { eq } from "drizzle-orm";
import { errorHandler } from "@/middlewares/error.middlewares.js";
import { users } from "@/models/apps/auth/user.models.js";
import { cartItems } from "@/models/apps/ecommerce/cart.models.js";
import { asyncHandler } from "@/utils/asyncHandler.js";
import { clearDb, ensureTestDb } from "../helpers/db.js";

/**
 * P8 gate: SQLSTATE client errors must map to HTTP 400 via error.middlewares.js.
 *
 * Controllers usually pre-check uniqueness / validate UUIDs, so these routes
 * deliberately hit Postgres so the middleware (not express-validator) is exercised.
 * Still HTTP + real DB — not a mocked unit stub.
 */
describe("error.middlewares — SQLSTATE → 400", () => {
  /** @type {import("supertest").SuperTest<import("supertest").Test>} */
  let agent;

  beforeAll(async () => {
    const db = await ensureTestDb();
    await clearDb();

    const app = express();
    app.use(express.json());

    app.post(
      "/_p8/unique-violation",
      asyncHandler(async (req, res) => {
        const email = req.body.email;
        const username = req.body.username;
        await db.insert(users).values({
          username,
          email,
          password: "hash",
        });
        // Second insert with same email → 23505
        await db.insert(users).values({
          username: `${username}_dup`,
          email,
          password: "hash",
        });
        res.json({ ok: true });
      })
    );

    app.get(
      "/_p8/bad-uuid",
      asyncHandler(async (_req, res) => {
        await db
          .select()
          .from(users)
          .where(eq(users.id, "not-a-uuid"));
        res.json({ ok: true });
      })
    );

    app.post(
      "/_p8/fk-violation",
      asyncHandler(async (_req, res) => {
        await db.insert(cartItems).values({
          cartId: randomUUID(),
          productId: randomUUID(),
          quantity: 1,
        });
        res.json({ ok: true });
      })
    );

    app.use(errorHandler);
    agent = request(app);
  });

  afterAll(async () => {
    await clearDb();
  });

  test("unique_violation (23505) → 400", async () => {
    const stamp = Date.now();
    const res = await agent.post("/_p8/unique-violation").send({
      email: `p8.unique.${stamp}@example.com`,
      username: `p8unique${stamp}`,
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/duplicate key|unique/i);
    expect(res.body.message).not.toMatch(/^Failed query:/);
  });

  test("invalid_text_representation / bad UUID (22P02) → 400", async () => {
    const res = await agent.get("/_p8/bad-uuid");

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/uuid|invalid input/i);
    expect(res.body.message).not.toMatch(/^Failed query:/);
  });

  test("foreign_key_violation (23503) → 400", async () => {
    const res = await agent.post("/_p8/fk-violation");

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/foreign key|violates/i);
    expect(res.body.message).not.toMatch(/^Failed query:/);
  });
});
