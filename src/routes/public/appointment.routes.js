import { Router } from "express";
import {
  getARandomAppointment,
  getAppointmentById,
  getAppointments,
} from "@/controllers/public/appointment.controllers.js";

const router = Router();

router.route("/").get(getAppointments);
router.route("/:appointmentId").get(getAppointmentById);
router.route("/appointment/random").get(getARandomAppointment);

export default router;
