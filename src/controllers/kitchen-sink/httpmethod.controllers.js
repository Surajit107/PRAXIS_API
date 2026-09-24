import { ApiResponse } from "@/utils/ApiResponse.js";
import { asyncHandler } from "@/utils/asyncHandler.js";

/** Methods this kitchen-sink module exposes (used by OPTIONS Allow). */
const HTTP_METHOD_ALLOW_LIST = [
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
  "TRACE",
  "CONNECT",
];

/**
 * @param {import("express").Request} req
 * @param {string} [methodOverride] Force educational method label (browser TRACE/CONNECT aliases).
 */
const getRequestMethodPayload = (req, methodOverride) => {
  return {
    method: methodOverride ?? req.method,
    headers: req.headers,
    origin: req.socket.localAddress,
    url: req.protocol + "://" + req.headers.host + req.originalUrl,
  };
};

/**
 * Build an RFC-style message/http echo of the received request.
 * @param {import("express").Request} req
 * @param {string} [methodOverride]
 */
const buildTraceEcho = (req, methodOverride) => {
  const method = methodOverride ?? req.method;
  const requestTarget = req.originalUrl || req.url;
  const headerLines = Object.entries(req.headers)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : value}`)
    .join("\r\n");

  return `${method} ${requestTarget} HTTP/1.1\r\n${headerLines}\r\n`;
};

const getRequest = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, getRequestMethodPayload(req), "GET request"));
});

const postRequest = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, getRequestMethodPayload(req), "POST request"));
});

const putRequest = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, getRequestMethodPayload(req), "PUT request"));
});

const patchRequest = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, getRequestMethodPayload(req), "PATCH request"));
});

const deleteRequest = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, getRequestMethodPayload(req), "DELETE request"));
});

/**
 * HEAD — same metadata as GET, but no response body (headers only).
 */
const headRequest = asyncHandler(async (req, res) => {
  const payload = new ApiResponse(200, getRequestMethodPayload(req), "HEAD request");
  const body = JSON.stringify(payload);

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Length", Buffer.byteLength(body));
  res.setHeader("ETag", `W/"praxis-head-${Buffer.byteLength(body)}"`);

  return res.status(200).end();
});

/**
 * OPTIONS — advertise allowed methods for this URI (teaching CORS / Allow).
 */
const optionsRequest = asyncHandler(async (req, res) => {
  const allow = HTTP_METHOD_ALLOW_LIST.join(", ");

  res.setHeader("Allow", allow);
  res.setHeader("Access-Control-Allow-Methods", allow);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        ...getRequestMethodPayload(req),
        allow: HTTP_METHOD_ALLOW_LIST,
      },
      "OPTIONS request"
    )
  );
});

/**
 * TRACE — echo the request as message/http (diagnostic; often disabled in production).
 * GET on the same path is a browser playground alias (Fetch forbids TRACE).
 */
const traceRequest = asyncHandler(async (req, res) => {
  const viaBrowserAlias = req.method === "GET";
  const methodLabel = "TRACE";
  const echo = buildTraceEcho(req, methodLabel);

  if (viaBrowserAlias) {
    // JSON envelope so the playground can render a useful demo body.
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          ...getRequestMethodPayload(req, methodLabel),
          contentType: "message/http",
          echo,
          note: "Browser Fetch forbids TRACE. This GET alias returns the TRACE teaching echo; use curl -X TRACE on the same path for the real verb.",
        },
        "TRACE request (browser alias)"
      )
    );
  }

  res.setHeader("Content-Type", "message/http");
  return res.status(200).send(echo);
});

/**
 * CONNECT — teaching stub for proxy tunnel semantics (not a real TCP tunnel).
 * Express only serves the GET alias (Fetch forbids CONNECT; Node delivers real
 * CONNECT via http.Server `connect` — see attachConnectTeachingHandler).
 */
const connectRequest = asyncHandler(async (req, res) => {
  const methodLabel = "CONNECT";
  const target = req.headers.host ?? "unknown";

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        ...getRequestMethodPayload(req, methodLabel),
        tunnel: {
          established: true,
          target,
          note: "Teaching stub — a real CONNECT asks a proxy to open a raw TCP tunnel. Praxis does not open a live tunnel.",
        },
        note: "Browser Fetch forbids CONNECT. This GET alias returns the CONNECT teaching payload; a real CONNECT to this path is handled on the HTTP server when the API is listening.",
      },
      "CONNECT request (browser alias)"
    )
  );
});

export {
  getRequest,
  postRequest,
  putRequest,
  patchRequest,
  deleteRequest,
  headRequest,
  optionsRequest,
  traceRequest,
  connectRequest,
};
