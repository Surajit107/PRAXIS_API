import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import { getTestAgent } from "../../helpers/app.js";
import { clearDb } from "../../helpers/db.js";
import { registerAndLogin } from "../../helpers/ecommerce.js";

describe("Chat app — chats", () => {
  /** @type {import("supertest").SuperTest<import("supertest").Test>} */
  let agent;
  /** @type {{ auth: Record<string, string>, user: { _id: string } }} */
  let alice;
  /** @type {{ auth: Record<string, string>, user: { _id: string } }} */
  let bob;
  /** @type {{ auth: Record<string, string>, user: { _id: string } }} */
  let carol;
  /** @type {string} */
  let oneOnOneChatId;
  /** @type {string} */
  let groupChatId;

  beforeAll(async () => {
    agent = await getTestAgent();
    await clearDb();

    const stamp = Date.now();
    alice = await registerAndLogin(agent, {
      email: `chat.alice.${stamp}@example.com`,
      username: `chatalice${stamp}`,
    });
    bob = await registerAndLogin(agent, {
      email: `chat.bob.${stamp}@example.com`,
      username: `chatbob${stamp}`,
    });
    carol = await registerAndLogin(agent, {
      email: `chat.carol.${stamp}@example.com`,
      username: `chatcarol${stamp}`,
    });
  }, 60_000);

  afterAll(async () => {
    await clearDb();
  });

  test("GET /users lists available users (excludes self)", async () => {
    const res = await agent
      .get("/api/v1/chat-app/chats/users")
      .set(alice.auth);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.every((u) => u._id !== alice.user._id)).toBe(true);
    expect(res.body.data[0]).toEqual(
      expect.objectContaining({
        _id: expect.any(String),
        username: expect.any(String),
        email: expect.any(String),
        avatar: expect.objectContaining({
          url: expect.any(String),
        }),
      })
    );
  });

  test("POST /c/:receiverId creates one-on-one chat with hydrated participants", async () => {
    const res = await agent
      .post(`/api/v1/chat-app/chats/c/${bob.user._id}`)
      .set(alice.auth);

    expect(res.status).toBe(201);
    expect(res.body.data._id).toBeDefined();
    expect(res.body.data.isGroupChat).toBe(false);
    expect(res.body.data.name).toBe("One on one chat");
    expect(res.body.data.admin).toBe(alice.user._id);
    expect(res.body.data.participants).toHaveLength(2);
    expect(res.body.data.participants.map((p) => p._id).sort()).toEqual(
      [alice.user._id, bob.user._id].sort()
    );
    expect(res.body.data.participants[0].avatar).toEqual(
      expect.objectContaining({ url: expect.any(String) })
    );
    expect(res.body.data.lastMessage).toBeNull();

    oneOnOneChatId = res.body.data._id;
  });

  test("POST /c/:receiverId is idempotent (returns existing chat)", async () => {
    const res = await agent
      .post(`/api/v1/chat-app/chats/c/${bob.user._id}`)
      .set(alice.auth);

    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe(oneOnOneChatId);
  });

  test("POST /group creates group with ≥3 members", async () => {
    const res = await agent
      .post("/api/v1/chat-app/chats/group")
      .set(alice.auth)
      .send({
        name: "Project Room",
        participants: [bob.user._id, carol.user._id],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.isGroupChat).toBe(true);
    expect(res.body.data.name).toBe("Project Room");
    expect(res.body.data.admin).toBe(alice.user._id);
    expect(res.body.data.participants).toHaveLength(3);

    groupChatId = res.body.data._id;
  });

  test("GET /group/:chatId returns hydrated group", async () => {
    const res = await agent
      .get(`/api/v1/chat-app/chats/group/${groupChatId}`)
      .set(alice.auth);

    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe(groupChatId);
    expect(res.body.data.participants.every((p) => p._id && p.username)).toBe(
      true
    );
  });

  test("PATCH /group/:chatId renames (admin only)", async () => {
    const res = await agent
      .patch(`/api/v1/chat-app/chats/group/${groupChatId}`)
      .set(alice.auth)
      .send({ name: "Renamed Room" });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Renamed Room");
  });

  test("GET / lists chats for the logged-in user", async () => {
    const res = await agent.get("/api/v1/chat-app/chats").set(alice.auth);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    expect(res.body.data.every((c) => c._id && Array.isArray(c.participants))).toBe(
      true
    );
  });

  test("POST add participant / DELETE remove participant", async () => {
    // Create a fourth user to add
    const dave = await registerAndLogin(agent, {
      email: `chat.dave.${Date.now()}@example.com`,
      username: `chatdave${Date.now()}`,
    });

    const addRes = await agent
      .post(
        `/api/v1/chat-app/chats/group/${groupChatId}/${dave.user._id}`
      )
      .set(alice.auth);

    expect(addRes.status).toBe(200);
    expect(
      addRes.body.data.participants.some((p) => p._id === dave.user._id)
    ).toBe(true);

    const removeRes = await agent
      .delete(
        `/api/v1/chat-app/chats/group/${groupChatId}/${dave.user._id}`
      )
      .set(alice.auth);

    expect(removeRes.status).toBe(200);
    expect(
      removeRes.body.data.participants.some((p) => p._id === dave.user._id)
    ).toBe(false);
  });

  test("DELETE /leave/group/:chatId leaves group", async () => {
    const res = await agent
      .delete(`/api/v1/chat-app/chats/leave/group/${groupChatId}`)
      .set(carol.auth);

    expect(res.status).toBe(200);
    expect(
      res.body.data.participants.some((p) => p._id === carol.user._id)
    ).toBe(false);
  });

  test("DELETE /remove/:chatId deletes one-on-one", async () => {
    const res = await agent
      .delete(`/api/v1/chat-app/chats/remove/${oneOnOneChatId}`)
      .set(alice.auth);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({});
  });

  test("DELETE /group/:chatId deletes group (admin)", async () => {
    const res = await agent
      .delete(`/api/v1/chat-app/chats/group/${groupChatId}`)
      .set(alice.auth);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({});
  });
});
