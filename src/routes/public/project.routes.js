import { Router } from "express";
import {
  getARandomProject,
  getProjectById,
  getProjects,
} from "@/controllers/public/project.controllers.js";

const router = Router();

router.route("/").get(getProjects);
router.route("/:projectId").get(getProjectById);
router.route("/project/random").get(getARandomProject);

export default router;
