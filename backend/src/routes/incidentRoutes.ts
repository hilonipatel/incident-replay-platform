import { Router } from "express";
import {
  createIncident,
  listIncidents,
  getIncident,
} from "../controllers/incidentController";
import eventRoutes from "./eventRoutes";
import replayRoutes from "./replayRoutes";

const router = Router();

router.post("/", createIncident);
router.get("/", listIncidents);
router.get("/:id", getIncident);

router.use("/:id/events", eventRoutes);
router.use("/:id/replays", replayRoutes);

export default router;