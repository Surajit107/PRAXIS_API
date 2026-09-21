import { Router } from "express";
import {
  getARandomShipment,
  getShipmentById,
  getShipments,
} from "@/controllers/public/shipment.controllers.js";

const router = Router();

router.route("/").get(getShipments);
router.route("/:shipmentId").get(getShipmentById);
router.route("/shipment/random").get(getARandomShipment);

export default router;
