import { Router } from "express";
import {
  getARandomEmployee,
  getEmployeeById,
  getEmployees,
} from "@/controllers/public/employee.controllers.js";

const router = Router();

router.route("/").get(getEmployees);
router.route("/:employeeId").get(getEmployeeById);
router.route("/employee/random").get(getARandomEmployee);

export default router;
