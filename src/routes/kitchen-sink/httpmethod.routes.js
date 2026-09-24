import { Router } from "express";
import {
  connectRequest,
  deleteRequest,
  getRequest,
  headRequest,
  optionsRequest,
  patchRequest,
  postRequest,
  putRequest,
  traceRequest,
} from "@/controllers/kitchen-sink/httpmethod.controllers.js";

const router = Router();

router.route("/get").get(getRequest);
router.route("/post").post(postRequest);
router.route("/put").put(putRequest);
router.route("/patch").patch(patchRequest);
router.route("/delete").delete(deleteRequest);

router.route("/head").head(headRequest);
router.route("/options").options(optionsRequest);

// TRACE: real verb for curl/Postman; GET alias for browser playground (Fetch forbids TRACE).
router.route("/trace").trace(traceRequest).get(traceRequest);

// CONNECT never reaches Express on Node's HTTP server (emits `connect`, not `request`).
// Real CONNECT is handled in attachConnectTeachingHandler(httpServer).
// GET alias remains for the browser playground (Fetch forbids CONNECT).
router.route("/connect").get(connectRequest);

export default router;
