import { Router } from "express";
import {
  getARandomCompany,
  getCompanyById,
  getCompanies,
} from "@/controllers/public/company.controllers.js";

const router = Router();

router.route("/").get(getCompanies);
router.route("/:companyId").get(getCompanyById);
router.route("/company/random").get(getARandomCompany);

export default router;
