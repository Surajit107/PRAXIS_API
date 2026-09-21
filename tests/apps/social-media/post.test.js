import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import { getTestAgent } from "../../helpers/app.js";
import { clearDb } from "../../helpers/db.js";
import { TINY_PNG, registerAndLogin } from "../../helpers/social-media.js";

describe("Social media — posts", () => {
  /** @type {import("supertest").SuperTest<import("supertest").Test>} */
  let agent;
  /** @type {Record<string, string>} */
  let auth;
  /** @type {{ username: string }} */
  let credentials;
  /** @type {string} */
  let postId;
  /** @type {string} */
  let imageId;

  beforeAll(async () => {
    agent = await getTestAgent();
    await clearDb();
    const session = await registerAndLogin(agent, {
      email: `social.post.${Date.now()}@example.com`,
      username: `socialpost${Date.now()}`,
    });
    auth = session.auth;
    credentials = session.credentials;
  });

  afterAll(async () => {
    await clearDb();
  });

  test("POST /api/v1/social-media/posts creates hydrated post with images", async () => {
    const res = await agent
      .post("/api/v1/social-media/posts")
      .set(auth)
      .field("content", "Hello social world")
      .field("tags", "alpha")
      .field("tags", "beta")
      .attach("images", TINY_PNG, "post1.png");

    expect(res.status).toBe(201);
    expect(res.body.data._id).toBeDefined();
    expect(res.body.data.content).toBe("Hello social world");
    expect(res.body.data.tags).toEqual(expect.arrayContaining(["alpha", "beta"]));
    expect(res.body.data.images).toHaveLength(1);
    expect(res.body.data.images[0]._id).toBeDefined();
    expect(res.body.data.images[0].url).toEqual(expect.any(String));
    expect(res.body.data.author).toEqual(
      expect.objectContaining({
        account: expect.objectContaining({
          username: credentials.username,
        }),
      })
    );
    expect(res.body.data.likes).toBe(0);
    expect(res.body.data.comments).toBe(0);
    expect(res.body.data.isLiked).toBe(false);
    expect(res.body.data.isBookmarked).toBe(false);

    postId = res.body.data._id;
    imageId = res.body.data.images[0]._id;
  });

  test("GET /api/v1/social-media/posts returns paginated posts", async () => {
    const res = await agent.get("/api/v1/social-media/posts?page=1&limit=10");

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      totalPosts: 1,
      posts: expect.any(Array),
    });
    expect(res.body.data.posts[0]._id).toBe(postId);
    expect(res.body.data.posts[0].images).toEqual(expect.any(Array));
  });

  test("GET /api/v1/social-media/posts/:id hydrates flags and counts", async () => {
    const res = await agent
      .get(`/api/v1/social-media/posts/${postId}`)
      .set(auth);

    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe(postId);
    expect(res.body.data.author.coverImage).toBeDefined();
    expect(typeof res.body.data.isLiked).toBe("boolean");
    expect(typeof res.body.data.isBookmarked).toBe("boolean");
  });

  test("GET my / by username / by tag", async () => {
    const myRes = await agent
      .get("/api/v1/social-media/posts/get/my")
      .set(auth);
    expect(myRes.status).toBe(200);
    expect(myRes.body.data.totalPosts).toBe(1);

    const userRes = await agent.get(
      `/api/v1/social-media/posts/get/u/${credentials.username}`
    );
    expect(userRes.status).toBe(200);
    expect(userRes.body.data.totalPosts).toBe(1);

    const tagRes = await agent.get("/api/v1/social-media/posts/get/t/alpha");
    expect(tagRes.status).toBe(200);
    expect(tagRes.body.data.totalPosts).toBeGreaterThanOrEqual(1);
  });

  test("PATCH remove image deletes nested row", async () => {
    const res = await agent
      .patch(`/api/v1/social-media/posts/remove/image/${postId}/${imageId}`)
      .set(auth);

    expect(res.status).toBe(200);
    expect(res.body.data.images).toHaveLength(0);
  });

  test("DELETE /api/v1/social-media/posts/:id deletes post", async () => {
    const res = await agent
      .delete(`/api/v1/social-media/posts/${postId}`)
      .set(auth);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({});

    const getRes = await agent.get(`/api/v1/social-media/posts/${postId}`);
    expect(getRes.status).toBe(404);
  });
});
