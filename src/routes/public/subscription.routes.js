import { Router } from "express";
import {
  getARandomSubscription,
  getSubscriptionById,
  getSubscriptions,
} from "@/controllers/public/subscription.controllers.js";

const router = Router();

router.route("/").get(getSubscriptions);
router.route("/:subscriptionId").get(getSubscriptionById);
router.route("/subscription/random").get(getARandomSubscription);

export default router;
