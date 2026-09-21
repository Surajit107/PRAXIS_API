import { Router } from "express";
import {
  listCities,
  listCountries,
  listStates,
} from "@/controllers/public/geo.controllers.js";

const router = Router();

router.route("/countries").get(listCountries);
router.route("/states").get(listStates);
router.route("/cities").get(listCities);

export default router;
