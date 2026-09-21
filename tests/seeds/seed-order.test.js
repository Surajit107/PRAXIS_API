import fs from "fs";
import path from "path";
import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import { count, eq } from "drizzle-orm";
import { UserRolesEnum } from "@/constants.js";
import { dbInstance } from "@/db/index.js";
import { users } from "@/models/apps/auth/user.models.js";
import { chats } from "@/models/apps/chat-app/chat.models.js";
import { categories } from "@/models/apps/ecommerce/category.models.js";
import { products } from "@/models/apps/ecommerce/product.models.js";
import { socialPosts } from "@/models/apps/social-media/post.models.js";
import { todos } from "@/models/apps/todo/todo.models.js";
import {
  TODOS_COUNT,
  USERS_COUNT,
} from "@/seeds/_constants.js";
import { getTestAgent } from "../helpers/app.js";
import { clearDb } from "../helpers/db.js";

/**
 * F9 — seed order:
 *   todos → domain only
 *   ecommerce / social-media / chat-app → seedUsers then domain seed
 */
describe("Seed order", () => {
  /** @type {import("supertest").SuperTest<import("supertest").Test>} */
  let agent;

  beforeAll(async () => {
    agent = await getTestAgent();
    await clearDb();
  }, 60_000);

  afterAll(async () => {
    await clearDb();
  });

  test("app.js wires seedUsers before ecommerce / social / chat domain seeds", () => {
    const appSrc = fs.readFileSync(
      path.resolve("./src/app.js"),
      "utf8"
    );

    const extractPostBlock = (route) => {
      const re = new RegExp(
        `app\\.post\\(\\s*"${route.replace(/\//g, "\\/")}"[\\s\\S]*?\\);`,
        "m"
      );
      const match = appSrc.match(re);
      expect(match).not.toBeNull();
      return match?.[0] ?? "";
    };

    const ecommerce = extractPostBlock("/api/v1/seed/ecommerce");
    const social = extractPostBlock("/api/v1/seed/social-media");
    const chat = extractPostBlock("/api/v1/seed/chat-app");
    const todosRoute = extractPostBlock("/api/v1/seed/todos");

    expect(ecommerce.indexOf("seedUsers")).toBeLessThan(
      ecommerce.indexOf("seedEcommerce")
    );
    expect(social.indexOf("seedUsers")).toBeLessThan(
      social.indexOf("seedSocialMedia")
    );
    expect(chat.indexOf("seedUsers")).toBeLessThan(
      chat.indexOf("seedChatApp")
    );
    expect(todosRoute).toContain("seedTodos");
    expect(todosRoute).not.toContain("seedUsers");
  });

  test("POST /api/v1/seed/todos seeds domain without users", async () => {
    const beforeUsers = await dbInstance.select({ value: count() }).from(users);
    expect(Number(beforeUsers[0]?.value ?? 0)).toBe(0);

    const res = await agent.post("/api/v1/seed/todos");
    expect(res.status).toBe(201);

    const [todoRow] = await dbInstance.select({ value: count() }).from(todos);
    expect(Number(todoRow?.value ?? 0)).toBe(TODOS_COUNT);

    const afterUsers = await dbInstance.select({ value: count() }).from(users);
    expect(Number(afterUsers[0]?.value ?? 0)).toBe(0);
  });

  test(
    "POST /api/v1/seed/chat-app runs users → chat domain + credentials",
    async () => {
      const res = await agent.post("/api/v1/seed/chat-app");
      expect(res.status).toBe(201);
      expect(res.body.message).toMatch(/chat app/i);

      const [userRow] = await dbInstance.select({ value: count() }).from(users);
      expect(Number(userRow?.value ?? 0)).toBe(USERS_COUNT);

      const [admin] = await dbInstance
        .select({ id: users.id })
        .from(users)
        .where(eq(users.role, UserRolesEnum.ADMIN))
        .limit(1);
      expect(admin?.id).toBeDefined();

      const [chatRow] = await dbInstance.select({ value: count() }).from(chats);
      expect(Number(chatRow?.value ?? 0)).toBeGreaterThan(0);

      const credRes = await agent.get("/api/v1/seed/generated-credentials");
      expect(credRes.status).toBe(200);
      expect(credRes.body.data).toHaveLength(USERS_COUNT);
      expect(credRes.body.data[0]).toEqual(
        expect.objectContaining({
          username: expect.any(String),
          password: expect.any(String),
          role: UserRolesEnum.ADMIN,
        })
      );
    },
    180_000
  );

  test(
    "POST /api/v1/seed/ecommerce skips user recreate and seeds domain",
    async () => {
      const [usersBefore] = await dbInstance
        .select({ value: count() })
        .from(users);
      expect(Number(usersBefore?.value ?? 0)).toBe(USERS_COUNT);

      const res = await agent.post("/api/v1/seed/ecommerce");
      expect(res.status).toBe(201);
      expect(res.body.message).toMatch(/ecommerce/i);

      const [usersAfter] = await dbInstance
        .select({ value: count() })
        .from(users);
      expect(Number(usersAfter?.value ?? 0)).toBe(USERS_COUNT);

      const [catRow] = await dbInstance
        .select({ value: count() })
        .from(categories);
      const [prodRow] = await dbInstance
        .select({ value: count() })
        .from(products);
      expect(Number(catRow?.value ?? 0)).toBeGreaterThan(0);
      expect(Number(prodRow?.value ?? 0)).toBeGreaterThan(0);
    },
    120_000
  );

  test(
    "POST /api/v1/seed/social-media keeps users and seeds posts",
    async () => {
      const res = await agent.post("/api/v1/seed/social-media");
      expect(res.status).toBe(201);
      expect(res.body.message).toMatch(/social media/i);

      const [userRow] = await dbInstance.select({ value: count() }).from(users);
      expect(Number(userRow?.value ?? 0)).toBe(USERS_COUNT);

      const [postRow] = await dbInstance
        .select({ value: count() })
        .from(socialPosts);
      expect(Number(postRow?.value ?? 0)).toBeGreaterThan(0);
    },
    180_000
  );
});
