import fs from "fs";
import path from "path";
import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import { eq } from "drizzle-orm";
import { UserRolesEnum } from "@/constants.js";
import { dbInstance } from "@/db/index.js";
import { hashPassword } from "@/models/apps/auth/user.helpers.js";
import { users } from "@/models/apps/auth/user.models.js";
import { ensureUserSideEffects } from "@/models/apps/auth/user.side-effects.js";
import { getTestAgent } from "../../helpers/app.js";
import { clearDb, ensureTestDb } from "../../helpers/db.js";

/**
 * Seed smoke without hashing 50 faker users:
 * insert one ADMIN so ecommerce seed can run domain tables,
 * then stub seedUsers skip by ensuring USERS_COUNT users exist.
 *
 * Practical gate: POST /seed/ecommerce after ensuring admin exists via the
 * real seedUsers path would be too slow; we verify the ecommerce seed handler
 * + credentials endpoint contract instead by:
 * 1) Creating admin + enough users via DB to satisfy seedUsers skip
 * 2) Writing credentials file like user seed does
 * 3) Hitting ecommerce seed + generated-credentials
 *
 * If user count < USERS_COUNT, seedUsers would wipe and recreate 50 users.
 * So we insert USERS_COUNT users (fast: shared password hash once).
 */
describe("Ecommerce — seed smoke", () => {
  /** @type {import("supertest").SuperTest<import("supertest").Test>} */
  let agent;

  beforeAll(async () => {
    agent = await getTestAgent();
    await clearDb();
    await ensureTestDb();

    const { USERS_COUNT } = await import("@/seeds/_constants.js");
    const passwordHash = await hashPassword("SeedPass123!");
    const credentials = [];

    // Per-user transaction keeps insert + side-effects atomic on Neon.
    for (let i = 0; i < USERS_COUNT; i++) {
      const role = i === 0 ? UserRolesEnum.ADMIN : UserRolesEnum.USER;
      const username = `seeduser${i}`;
      const email = `seeduser${i}@example.com`;
      credentials.push({ username, password: "SeedPass123!", role });

      await dbInstance.transaction(async (tx) => {
        const [created] = await tx
          .insert(users)
          .values({
            username,
            email,
            password: passwordHash,
            isEmailVerified: true,
            role,
          })
          .returning({ id: users.id });

        await ensureUserSideEffects(tx, created.id);
      });
    }

    const credentialsPath = path.resolve("./public/temp/seed-credentials.json");
    fs.mkdirSync(path.dirname(credentialsPath), { recursive: true });
    fs.writeFileSync(credentialsPath, JSON.stringify(credentials), "utf8");
  }, 120_000);

  afterAll(async () => {
    await clearDb();
  });

  test("POST /api/v1/seed/ecommerce populates domain", async () => {
    const res = await agent.post("/api/v1/seed/ecommerce");

    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/ecommerce/i);

    const [admin] = await dbInstance
      .select()
      .from(users)
      .where(eq(users.role, UserRolesEnum.ADMIN))
      .limit(1);
    expect(admin).toBeDefined();
  }, 120_000);

  test("GET /api/v1/seed/generated-credentials still readable", async () => {
    const res = await agent.get("/api/v1/seed/generated-credentials");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toEqual(
      expect.objectContaining({
        username: expect.any(String),
        password: expect.any(String),
        role: expect.any(String),
      })
    );
  });
});
