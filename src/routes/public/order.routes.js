import { Router } from "express";
import {
  getARandomPublicOrder,
  getPublicOrderById,
  getPublicOrders,
} from "@/controllers/public/order.controllers.js";

const router = Router();

router.route("/").get(getPublicOrders);
router.route("/:orderId").get(getPublicOrderById);
router.route("/order/random").get(getARandomPublicOrder);

export default router;
