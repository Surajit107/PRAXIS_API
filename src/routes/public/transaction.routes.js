import { Router } from "express";
import {
  getARandomTransaction,
  getTransactionById,
  getTransactions,
} from "@/controllers/public/transaction.controllers.js";

const router = Router();

router.route("/").get(getTransactions);
router.route("/:transactionId").get(getTransactionById);
router.route("/transaction/random").get(getARandomTransaction);

export default router;
