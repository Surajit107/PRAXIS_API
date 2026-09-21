import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import { getTestAgent } from "../../helpers/app.js";
import { clearDb } from "../../helpers/db.js";
import { registerAndLogin } from "../../helpers/social-media.js";

describe("Social media — bookmarks", () => {
  /** @type {import("supertest").SuperTest<import("supertest").Test>} */
  let agent;
  /** @type {Record<string, string>} */
  let auth;
  /** @type {string} */
  let postId;

  beforeAll(async () => {
    agent = await getTestAgent();
    await clearDb();
    const session = await registerAndLogin(agent, {
      email: `social.bm.${Date.now()}@example.com`,
      username: `socialbm${Date.now()}`,
    });
    auth = session.auth;

    const postRes = await agent
      .post("/api/v1/social-media/posts")
      .set(auth)
      .field("content", "Bookmarkable post");
    postId = postRes.body.data._id;
  });

  afterAll(async () => {
    await clearDb();
  });

  test("POST bookmark/unbookmark toggles isBookmarked", async () => {
    const bookmarkRes = await agent
      .post(`/api/v1/social-media/bookmarks/${postId}`)
      .set(auth);
    expect(bookmarkRes.status).toBe(200);
    expect(bookmarkRes.body.data.isBookmarked).toBe(true);

    const postRes = await agent
      .get(`/api/v1/social-media/posts/${postId}`)
      .set(auth);
    expect(postRes.body.data.isBookmarked).toBe(true);

    const listRes = await agent
      .get("/api/v1/social-media/bookmarks")
      .set(auth);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.totalBookmarkedPosts).toBe(1);
    expect(listRes.body.data.bookmarkedPosts[0]._id).toBe(postId);
    expect(listRes.body.data.bookmarkedPosts[0].images).toEqual(
      expect.any(Array)
    );

    const unbookmarkRes = await agent
      .post(`/api/v1/social-media/bookmarks/${postId}`)
      .set(auth);
    expect(unbookmarkRes.status).toBe(200);
    expect(unbookmarkRes.body.data.isBookmarked).toBe(false);
  });
});
