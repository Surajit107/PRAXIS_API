import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import { getTestAgent } from "../../helpers/app.js";
import { clearDb } from "../../helpers/db.js";
import { registerAndLogin } from "../../helpers/social-media.js";

describe("Social media — follow", () => {
  /** @type {import("supertest").SuperTest<import("supertest").Test>} */
  let agent;
  /** @type {Awaited<ReturnType<typeof registerAndLogin>>} */
  let a;
  /** @type {Awaited<ReturnType<typeof registerAndLogin>>} */
  let b;

  beforeAll(async () => {
    agent = await getTestAgent();
    await clearDb();
    a = await registerAndLogin(agent, {
      email: `social.follow.a.${Date.now()}@example.com`,
      username: `socialfa${Date.now()}`,
    });
    b = await registerAndLogin(agent, {
      email: `social.follow.b.${Date.now()}@example.com`,
      username: `socialfb${Date.now()}`,
    });
  });

  afterAll(async () => {
    await clearDb();
  });

  test("cannot follow yourself", async () => {
    const res = await agent
      .post(`/api/v1/social-media/follow/${a.user._id}`)
      .set(a.auth);
    expect(res.status).toBe(422);
  });

  test("follow/unfollow toggles following", async () => {
    const followRes = await agent
      .post(`/api/v1/social-media/follow/${b.user._id}`)
      .set(a.auth);
    expect(followRes.status).toBe(200);
    expect(followRes.body.data.following).toBe(true);

    const unfollowRes = await agent
      .post(`/api/v1/social-media/follow/${b.user._id}`)
      .set(a.auth);
    expect(unfollowRes.status).toBe(200);
    expect(unfollowRes.body.data.following).toBe(false);

    // re-follow for list tests
    await agent.post(`/api/v1/social-media/follow/${b.user._id}`).set(a.auth);
  });

  test("GET followers list includes user header + isFollowing flags", async () => {
    const res = await agent
      .get(`/api/v1/social-media/follow/list/followers/${b.credentials.username}`)
      .set(b.auth);

    expect(res.status).toBe(200);
    expect(res.body.data.user).toEqual(
      expect.objectContaining({
        username: b.credentials.username,
        profile: expect.objectContaining({
          coverImage: expect.any(Object),
        }),
      })
    );
    expect(res.body.data.totalFollowers).toBe(1);
    expect(res.body.data.followers[0]).toEqual(
      expect.objectContaining({
        username: a.credentials.username,
        isFollowing: false,
        profile: expect.any(Object),
        avatar: expect.any(Object),
      })
    );
  });

  test("GET following list paginates", async () => {
    const res = await agent
      .get(`/api/v1/social-media/follow/list/following/${a.credentials.username}`)
      .set(a.auth);

    expect(res.status).toBe(200);
    expect(res.body.data.totalFollowing).toBe(1);
    expect(res.body.data.following[0]).toEqual(
      expect.objectContaining({
        username: b.credentials.username,
        isFollowing: true,
      })
    );
  });
});
