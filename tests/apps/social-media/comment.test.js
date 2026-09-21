import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import { getTestAgent } from "../../helpers/app.js";
import { clearDb } from "../../helpers/db.js";
import { registerAndLogin } from "../../helpers/social-media.js";

describe("Social media — comments", () => {
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
      email: `social.comment.${Date.now()}@example.com`,
      username: `socialcmt${Date.now()}`,
    });
    auth = session.auth;

    const postRes = await agent
      .post("/api/v1/social-media/posts")
      .set(auth)
      .field("content", "Post for comments");
    postId = postRes.body.data._id;
  });

  afterAll(async () => {
    await clearDb();
  });

  test("POST /api/v1/social-media/comments/post/:postId adds comment", async () => {
    const res = await agent
      .post(`/api/v1/social-media/comments/post/${postId}`)
      .set(auth)
      .send({ content: "Nice post" });

    expect(res.status).toBe(201);
    expect(res.body.data._id).toBeDefined();
    expect(res.body.data.content).toBe("Nice post");
    expect(res.body.data.postId).toBe(postId);
    commentId = res.body.data._id;
  });

  test("GET comments paginates with author + likes + isLiked", async () => {
    const res = await agent
      .get(`/api/v1/social-media/comments/post/${postId}`)
      .set(auth);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      totalComments: 1,
      comments: expect.any(Array),
    });
    expect(res.body.data.comments[0]).toEqual(
      expect.objectContaining({
        _id: commentId,
        likes: 0,
        isLiked: false,
        author: expect.objectContaining({
          firstName: expect.any(String),
          lastName: expect.any(String),
          account: expect.objectContaining({
            username: expect.any(String),
            avatar: expect.any(Object),
          }),
        }),
      })
    );
  });

  test("PATCH comment updates content", async () => {
    const res = await agent
      .patch(`/api/v1/social-media/comments/${commentId}`)
      .set(auth)
      .send({ content: "Updated comment" });

    expect(res.status).toBe(200);
    expect(res.body.data.content).toBe("Updated comment");
  });

  test("DELETE comment returns deletedComment", async () => {
    const res = await agent
      .delete(`/api/v1/social-media/comments/${commentId}`)
      .set(auth);

    expect(res.status).toBe(200);
    expect(res.body.data.deletedComment._id).toBe(commentId);
  });
});
