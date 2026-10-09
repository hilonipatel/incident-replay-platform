import { Router } from "express";
import {
  replayIncident,
  getReplayResults,
} from "../controllers/replayController";

const router = Router({ mergeParams: true });

router.post("/", replayIncident);
router.get("/:replayId", getReplayResults);

export default router;