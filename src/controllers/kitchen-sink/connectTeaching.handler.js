import { ApiResponse } from "@/utils/ApiResponse.js";

const CONNECT_TEACHING_PATH = "/api/v1/kitchen-sink/http-methods/connect";

/**
 * Node's HTTP server emits `connect` for CONNECT — it never reaches Express `request`.
 * Without a listener, the socket is destroyed (clients see "socket hang up").
 *
 * Responds with `200 Connection Established` then a JSON teaching payload on the tunnel.
 *
 * @param {import("http").Server} httpServer
 */
export const attachConnectTeachingHandler = (httpServer) => {
  httpServer.on("connect", (req, clientSocket) => {
    const target = req.url ?? "";
    const isTeaching =
      target === CONNECT_TEACHING_PATH ||
      target.includes("kitchen-sink/http-methods/connect");

    if (!isTeaching) {
      clientSocket.write(
        "HTTP/1.1 405 Method Not Allowed\r\nConnection: close\r\nContent-Length: 0\r\n\r\n"
      );
      clientSocket.destroy();
      return;
    }

    const payload = new ApiResponse(
      200,
      {
        method: "CONNECT",
        headers: req.headers,
        origin: clientSocket.remoteAddress,
        url: target,
        tunnel: {
          established: true,
          target: req.headers.host ?? target,
          note: "Teaching stub — a real CONNECT asks a proxy to open a raw TCP tunnel. Praxis does not open a live tunnel.",
        },
      },
      "CONNECT request (simulated tunnel)"
    );

    const body = JSON.stringify(payload);

    // Classic CONNECT success line, then teaching JSON as tunnel bytes.
    clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
    clientSocket.write(body);
    clientSocket.end();
  });
};
