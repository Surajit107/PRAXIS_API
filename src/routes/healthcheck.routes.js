import { Router } from "express";
import {
  healthcheck,
  live,
  ready,
  version,
} from "@/controllers/healthcheck.controllers.js";

const router = Router();

router.route("/healthcheck").get(healthcheck);
router.route("/live").get(live);
router.route("/ready").get(ready);
router.route("/version").get(version);

export default router;
