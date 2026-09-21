import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import { getTestAgent } from "../helpers/app.js";
import { clearDb } from "../helpers/db.js";

describe("Auth — users", () => {
  /** @type {import("supertest").SuperTest<import("supertest").Test>} */
  let agent;

  const credentials = {
    email: "jest.auth@example.com",
    username: "jestauthuser",
    password: "Password123!",
  };

  /** @type {string | undefined} */
  let accessToken;
  /** @type {string | undefined} */
  let refreshToken;

  beforeAll(async () => {
    agent = await getTestAgent();
    await clearDb();
  });

  afterAll(async () => {
    await clearDb();
  });

  test("POST /api/v1/users/register creates user with shaped payload", async () => {
    const res = await agent.post("/api/v1/users/register").send(credentials);

    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({
      email: credentials.email,
      username: credentials.username,
      isEmailVerified: false,
    });
    expect(res.body.data.user._id).toBeDefined();
    expect(res.body.data.user.avatar).toEqual(
      expect.objectContaining({
        url: expect.any(String),
        localPath: expect.any(String),
      })
    );
    expect(res.body.data.user.password).toBeUndefined();
    expect(res.body.data.user.refreshToken).toBeUndefined();
  });

  test("POST /api/v1/users/register rejects duplicate email/username", async () => {
    const res = await agent.post("/api/v1/users/register").send(credentials);
    expect(res.status).toBe(409);
  });

  test("POST /api/v1/users/login returns tokens + sets cookies", async () => {
    const res = await agent.post("/api/v1/users/login").send({
      email: credentials.email,
      password: credentials.password,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.user._id).toBeDefined();
    expect(res.body.data.user.password).toBeUndefined();

    accessToken = res.body.data.accessToken;
    refreshToken = res.body.data.refreshToken;

    const cookies = res.headers["set-cookie"] ?? [];
    expect(cookies.some((c) => c.startsWith("accessToken="))).toBe(true);
    expect(cookies.some((c) => c.startsWith("refreshToken="))).toBe(true);
  });

  test("POST /api/v1/users/login rejects bad password", async () => {
    const res = await agent.post("/api/v1/users/login").send({
      email: credentials.email,
      password: "wrong-password",
    });
    expect(res.status).toBe(401);
  });

  test("GET /api/v1/users/current-user works with Bearer token", async () => {
    const res = await agent
      .get("/api/v1/users/current-user")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.username).toBe(credentials.username);
    expect(res.body.data._id).toBeDefined();
  });

  test("POST /api/v1/users/refresh-token rotates tokens", async () => {
    // jwt.sign iat is second-granular; wait so refreshed RT differs from login RT
    await new Promise((resolve) => setTimeout(resolve, 1100));

    const res = await agent
      .post("/api/v1/users/refresh-token")
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.refreshToken).not.toBe(refreshToken);

    accessToken = res.body.data.accessToken;
    refreshToken = res.body.data.refreshToken;
  });

  test("POST /api/v1/users/change-password updates password", async () => {
    const newPassword = "Password456!";
    const res = await agent
      .post("/api/v1/users/change-password")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        oldPassword: credentials.password,
        newPassword,
      });

    expect(res.status).toBe(200);

    const loginRes = await agent.post("/api/v1/users/login").send({
      email: credentials.email,
      password: newPassword,
    });
    expect(loginRes.status).toBe(200);
    accessToken = loginRes.body.data.accessToken;
    refreshToken = loginRes.body.data.refreshToken;
    credentials.password = newPassword;
  });

  test("POST /api/v1/users/logout clears refresh token", async () => {
    const res = await agent
      .post("/api/v1/users/logout")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);

    const refreshRes = await agent
      .post("/api/v1/users/refresh-token")
      .send({ refreshToken });
    expect(refreshRes.status).toBe(401);
  });
});
