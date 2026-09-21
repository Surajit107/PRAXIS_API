import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import { ChatEventEnum } from "@/constants.js";
import { httpServer } from "@/app.js";
import { getTestAgent } from "../../helpers/app.js";
import { clearDb } from "../../helpers/db.js";
import { registerAndLogin } from "../../helpers/ecommerce.js";

/**
 * Socket.IO chat event-name contract.
 */
describe("Chat app — Socket.IO event contract", () => {
  test("ChatEventEnum exposes canonical event string values", () => {
    expect(ChatEventEnum).toMatchObject({
      CONNECTED_EVENT: "connected",
      DISCONNECT_EVENT: "disconnect",
      JOIN_CHAT_EVENT: "joinChat",
      LEAVE_CHAT_EVENT: "leaveChat",
      UPDATE_GROUP_NAME_EVENT: "updateGroupName",
      MESSAGE_RECEIVED_EVENT: "messageReceived",
      NEW_CHAT_EVENT: "newChat",
      SOCKET_ERROR_EVENT: "socketError",
      STOP_TYPING_EVENT: "stopTyping",
      TYPING_EVENT: "typing",
      MESSAGE_DELETE_EVENT: "messageDeleted",
    });
  });
});

describe("Chat app — Socket.IO handshake auth smoke", () => {
  /** @type {import("supertest").SuperTest<import("supertest").Test>} */
  let agent;
  /** @type {string} */
  let accessToken;
  /** @type {number} */
  let port;

  beforeAll(async () => {
    agent = await getTestAgent();
    await clearDb();

    const session = await registerAndLogin(agent, {
      email: `socket.${Date.now()}@example.com`,
      username: `sockets${Date.now()}`,
    });
    accessToken = session.accessToken;

    await new Promise((resolve) => {
      httpServer.listen(0, "127.0.0.1", resolve);
    });
    const address = httpServer.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind httpServer for socket smoke");
    }
    port = address.port;
  }, 60_000);

  afterAll(async () => {
    await new Promise((resolve) => {
      httpServer.close(() => resolve(undefined));
    });
    await clearDb();
  });

  test("handshake with auth.token emits connected", async () => {
    const { io: ioc } = await import("socket.io-client");

    const socket = ioc(`http://127.0.0.1:${port}`, {
      auth: { token: accessToken },
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
    });

    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("socket connected timeout")),
          10_000
        );
        socket.on(ChatEventEnum.CONNECTED_EVENT, () => {
          clearTimeout(timer);
          resolve(undefined);
        });
        socket.on(ChatEventEnum.SOCKET_ERROR_EVENT, (msg) => {
          clearTimeout(timer);
          reject(new Error(String(msg)));
        });
        socket.on("connect_error", (err) => {
          clearTimeout(timer);
          reject(err);
        });
      });
    } finally {
      socket.disconnect();
    }
  }, 20_000);
});
