import { eq } from "drizzle-orm";
import { UserRolesEnum } from "@/constants.js";
import { dbInstance } from "@/db/index.js";
import { users } from "@/models/apps/auth/user.models.js";
import { ensureTestDb } from "./db.js";

/**
 * @param {import("supertest").SuperTest<import("supertest").Test>} agent
 * @param {Partial<{ email: string; username: string; password: string }>} [overrides]
 */
export async function registerAndLogin(agent, overrides = {}) {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const credentials = {
    email: overrides.email ?? `ecom.${suffix}@example.com`,
    username: overrides.username ?? `ecomuser${suffix}`,
    password: overrides.password ?? "Password123!",
  };

  const registerRes = await agent.post("/api/v1/users/register").send(credentials);
  if (registerRes.status !== 201) {
    throw new Error(
      `register failed: ${registerRes.status} ${JSON.stringify(registerRes.body)}`
    );
  }

  const loginRes = await agent.post("/api/v1/users/login").send({
    email: credentials.email,
    password: credentials.password,
  });
  if (loginRes.status !== 200) {
    throw new Error(
      `login failed: ${loginRes.status} ${JSON.stringify(loginRes.body)}`
    );
  }

  return {
    credentials,
    user: loginRes.body.data.user,
    accessToken: loginRes.body.data.accessToken,
    auth: { Authorization: `Bearer ${loginRes.body.data.accessToken}` },
  };
}

/**
 * @param {string} userId
 */
export async function promoteToAdmin(userId) {
  const db = await ensureTestDb();
  await db
    .update(users)
    .set({ role: UserRolesEnum.ADMIN })
    .where(eq(users.id, userId));
}

/**
 * Tiny 1x1 PNG for multer product uploads.
 */
export const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);
