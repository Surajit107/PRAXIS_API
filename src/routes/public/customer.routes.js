import { Router } from "express";
import {
  getARandomCustomer,
  getCustomerById,
  getCustomers,
} from "@/controllers/public/customer.controllers.js";

const router = Router();

router.route("/").get(getCustomers);
router.route("/:customerId").get(getCustomerById);
router.route("/customer/random").get(getARandomCustomer);

export default router;
