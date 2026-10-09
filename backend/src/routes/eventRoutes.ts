import { Router } from "express";
import {
  createEvent,
  listEvents,
} from "../controllers/eventController";

const router = Router({ mergeParams: true });

router.post("/", createEvent);
router.get("/", listEvents);

export default router;