import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import { getTestAgent } from "../../helpers/app.js";
import { clearDb } from "../../helpers/db.js";
import { TINY_PNG, registerAndLogin } from "../../helpers/ecommerce.js";

describe("Chat app — messages", () => {
  /** @type {import("supertest").SuperTest<import("supertest").Test>} */
  let agent;
  /** @type {Record<string, string>} */
  let auth;
  /** @type {string} */
  let chatId;
  /** @type {string} */
  let messageId;
  /** @type {string} */
  let attachmentMessageId;

  beforeAll(async () => {
    agent = await getTestAgent();
    await clearDb();

    const stamp = Date.now();
    const alice = await registerAndLogin(agent, {
      email: `msg.alice.${stamp}@example.com`,
      username: `msgalice${stamp}`,
    });
    const bob = await registerAndLogin(agent, {
      email: `msg.bob.${stamp}@example.com`,
      username: `msgbob${stamp}`,
    });
    auth = alice.auth;

    const chatRes = await agent
      .post(`/api/v1/chat-app/chats/c/${bob.user._id}`)
      .set(auth);
    expect(chatRes.status).toBe(201);
    chatId = chatRes.body.data._id;
  }, 60_000);

  afterAll(async () => {
    await clearDb();
  });

  test("POST /messages/:chatId sends text message with hydrated sender", async () => {
    const res = await agent
      .post(`/api/v1/chat-app/messages/${chatId}`)
      .set(auth)
      .field("content", "hello bob");

    expect(res.status).toBe(201);
    expect(res.body.data._id).toBeDefined();
    expect(res.body.data.content).toBe("hello bob");
    expect(res.body.data.chat).toBe(chatId);
    expect(res.body.data.attachments).toEqual([]);
    expect(res.body.data.sender).toEqual(
      expect.objectContaining({
        _id: expect.any(String),
        username: expect.any(String),
        email: expect.any(String),
        avatar: expect.objectContaining({ url: expect.any(String) }),
      })
    );

    messageId = res.body.data._id;
  });

  test("POST /messages/:chatId with attachment hydrates chat_message_attachments", async () => {
    const res = await agent
      .post(`/api/v1/chat-app/messages/${chatId}`)
      .set(auth)
      .field("content", "see attached")
      .attach("attachments", TINY_PNG, "shot.png");

    expect(res.status).toBe(201);
    expect(res.body.data.attachments).toHaveLength(1);
    expect(res.body.data.attachments[0]).toEqual(
      expect.objectContaining({
        _id: expect.any(String),
        url: expect.any(String),
        localPath: expect.any(String),
      })
    );

    attachmentMessageId = res.body.data._id;
  });

  test("GET /messages/:chatId returns messages newest-first with shapes", async () => {
    const res = await agent
      .get(`/api/v1/chat-app/messages/${chatId}`)
      .set(auth);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    expect(res.body.data[0]._id).toBe(attachmentMessageId);
    expect(res.body.data[0].sender.username).toEqual(expect.any(String));
    expect(Array.isArray(res.body.data[0].attachments)).toBe(true);
  });

  test("chat list lastMessage is hydrated after send", async () => {
    const res = await agent.get("/api/v1/chat-app/chats").set(auth);

    expect(res.status).toBe(200);
    const chat = res.body.data.find((c) => c._id === chatId);
    expect(chat).toBeDefined();
    expect(chat.lastMessage).toEqual(
      expect.objectContaining({
        _id: attachmentMessageId,
        content: "see attached",
        sender: expect.objectContaining({
          _id: expect.any(String),
          username: expect.any(String),
        }),
        attachments: expect.arrayContaining([
          expect.objectContaining({ _id: expect.any(String) }),
        ]),
      })
    );
  });

  test("DELETE /messages/:chatId/:messageId returns pre-delete shape (sender id string)", async () => {
    const res = await agent
      .delete(`/api/v1/chat-app/messages/${chatId}/${messageId}`)
      .set(auth);

    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe(messageId);
    expect(typeof res.body.data.sender).toBe("string");
    expect(Array.isArray(res.body.data.attachments)).toBe(true);
  });
});
