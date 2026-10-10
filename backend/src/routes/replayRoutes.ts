import { Router } from "express";
import {
  replayIncident,
  getReplayResults,
  listReplayHistory
} from "../controllers/replayController";

const router = Router({ mergeParams: true });

router.post("/", replayIncident);
router.get("/", listReplayHistory);
router.get("/:replayId", getReplayResults);

export default router;