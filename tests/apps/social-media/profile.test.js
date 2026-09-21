import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import { getTestAgent } from "../../helpers/app.js";
import { clearDb } from "../../helpers/db.js";
import { TINY_PNG, registerAndLogin } from "../../helpers/social-media.js";

describe("Social media — profile", () => {
  /** @type {import("supertest").SuperTest<import("supertest").Test>} */
  let agent;
  /** @type {Record<string, string>} */
  let auth;
  /** @type {{ username: string }} */
  let credentials;
  /** @type {{ _id: string }} */
  let user;
  /** @type {ReturnType<typeof registerAndLogin> extends Promise<infer T> ? T : never} */
  let other;

  beforeAll(async () => {
    agent = await getTestAgent();
    await clearDb();
    const session = await registerAndLogin(agent, {
      email: `social.profile.${Date.now()}@example.com`,
      username: `socialprof${Date.now()}`,
    });
    auth = session.auth;
    credentials = session.credentials;
    user = session.user;
    other = await registerAndLogin(agent, {
      email: `social.other.${Date.now()}@example.com`,
      username: `socialother${Date.now()}`,
    });
  });

  afterAll(async () => {
    await clearDb();
  });

  test("GET /api/v1/social-media/profile returns account join + counts", async () => {
    const res = await agent.get("/api/v1/social-media/profile").set(auth);

    expect(res.status).toBe(200);
    expect(res.body.data._id).toBeDefined();
    expect(res.body.data.coverImage).toEqual(
      expect.objectContaining({
        url: expect.any(String),
        localPath: expect.any(String),
      })
    );
    expect(res.body.data.account).toEqual(
      expect.objectContaining({
        _id: user._id,
        username: credentials.username,
        email: credentials.email,
        avatar: expect.objectContaining({ url: expect.any(String) }),
        isEmailVerified: expect.any(Boolean),
      })
    );
    expect(res.body.data.followersCount).toBe(0);
    expect(res.body.data.followingCount).toBe(0);
    expect(res.body.data.isFollowing).toBe(false);
  });

  test("PATCH /api/v1/social-media/profile updates fields and returns full shape", async () => {
    const res = await agent
      .patch("/api/v1/social-media/profile")
      .set(auth)
      .send({
        firstName: "Ada",
        lastName: "Lovelace",
        bio: "Mathematician",
        location: "London",
        phoneNumber: "9876543210",
        countryCode: "91",
        dob: "1990-01-15T00:00:00.000Z",
      });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      firstName: "Ada",
      lastName: "Lovelace",
      bio: "Mathematician",
      location: "London",
      phoneNumber: "9876543210",
      countryCode: "91",
    });
    expect(res.body.data.account._id).toBe(user._id);
  });

  test("GET /api/v1/social-media/profile/u/:username is public with isFollowing", async () => {
    await agent
      .post(`/api/v1/social-media/follow/${user._id}`)
      .set(other.auth);

    const res = await agent
      .get(`/api/v1/social-media/profile/u/${credentials.username}`)
      .set(other.auth);

    expect(res.status).toBe(200);
    expect(res.body.data.account.username).toBe(credentials.username);
    expect(res.body.data.followersCount).toBe(1);
    expect(res.body.data.isFollowing).toBe(true);
  });

  test("PATCH /api/v1/social-media/profile/cover-image updates coverImage", async () => {
    const res = await agent
      .patch("/api/v1/social-media/profile/cover-image")
      .set(auth)
      .attach("coverImage", TINY_PNG, "cover.png");

    expect(res.status).toBe(200);
    expect(res.body.data.coverImage.url).toEqual(expect.any(String));
    expect(res.body.data.coverImage.localPath).toEqual(expect.any(String));
    expect(res.body.data.coverImage.localPath.length).toBeGreaterThan(0);
  });
});
