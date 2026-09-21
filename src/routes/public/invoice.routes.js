import { Router } from "express";
import {
  getARandomInvoice,
  getInvoiceById,
  getInvoices,
} from "@/controllers/public/invoice.controllers.js";

const router = Router();

router.route("/").get(getInvoices);
router.route("/:invoiceId").get(getInvoiceById);
router.route("/invoice/random").get(getARandomInvoice);

export default router;
