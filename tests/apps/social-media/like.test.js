import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import { getTestAgent } from "../../helpers/app.js";
import { clearDb } from "../../helpers/db.js";
import { registerAndLogin } from "../../helpers/social-media.js";

describe("Social media — likes", () => {
  /** @type {import("supertest").SuperTest<import("supertest").Test>} */
  let agent;
  /** @type {Record<string, string>} */
  let auth;
  /** @type {string} */
  let postId;
  /** @type {string} */
  let commentId;

  beforeAll(async () => {
    agent = await getTestAgent();
    await clearDb();
    const session = await registerAndLogin(agent, {
      email: `social.like.${Date.now()}@example.com`,
      username: `sociallike${Date.now()}`,
    });
    auth = session.auth;

    const postRes = await agent
      .post("/api/v1/social-media/posts")
      .set(auth)
      .field("content", "Likeable post");
    postId = postRes.body.data._id;

    const commentRes = await agent
      .post(`/api/v1/social-media/comments/post/${postId}`)
      .set(auth)
      .send({ content: "Likeable comment" });
    commentId = commentRes.body.data._id;
  });

  afterAll(async () => {
    await clearDb();
  });

  test("POST like/unlike post toggles isLiked", async () => {
    const likeRes = await agent
      .post(`/api/v1/social-media/like/post/${postId}`)
      .set(auth);
    expect(likeRes.status).toBe(200);
    expect(likeRes.body.data.isLiked).toBe(true);

    const postRes = await agent
      .get(`/api/v1/social-media/posts/${postId}`)
      .set(auth);
    expect(postRes.body.data.isLiked).toBe(true);
    expect(postRes.body.data.likes).toBe(1);

    const unlikeRes = await agent
      .post(`/api/v1/social-media/like/post/${postId}`)
      .set(auth);
    expect(unlikeRes.status).toBe(200);
    expect(unlikeRes.body.data.isLiked).toBe(false);
  });

  test("POST like/unlike comment toggles isLiked", async () => {
    const likeRes = await agent
      .post(`/api/v1/social-media/like/comment/${commentId}`)
      .set(auth);
    expect(likeRes.status).toBe(200);
    expect(likeRes.body.data.isLiked).toBe(true);

    const commentsRes = await agent
      .get(`/api/v1/social-media/comments/post/${postId}`)
      .set(auth);
    expect(commentsRes.body.data.comments[0].isLiked).toBe(true);
    expect(commentsRes.body.data.comments[0].likes).toBe(1);

    const unlikeRes = await agent
      .post(`/api/v1/social-media/like/comment/${commentId}`)
      .set(auth);
    expect(unlikeRes.status).toBe(200);
    expect(unlikeRes.body.data.isLiked).toBe(false);
  });
});
