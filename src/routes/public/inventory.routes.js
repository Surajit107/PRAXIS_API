import { Router } from "express";
import {
  getARandomInventory,
  getInventoryById,
  getInventory,
} from "@/controllers/public/inventory.controllers.js";

const router = Router();

router.route("/").get(getInventory);
router.route("/:inventoryId").get(getInventoryById);
router.route("/item/random").get(getARandomInventory);

export default router;
