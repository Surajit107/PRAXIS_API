import { Router } from "express";
import {
  getARandomTicket,
  getTicketById,
  getTickets,
} from "@/controllers/public/ticket.controllers.js";

const router = Router();

router.route("/").get(getTickets);
router.route("/:ticketId").get(getTicketById);
router.route("/ticket/random").get(getARandomTicket);

export default router;
