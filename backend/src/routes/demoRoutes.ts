import { Router } from "express";
import {
  createOrder,
  processPayment,
  getOrder,
} from "../controllers/demoController";

const router = Router();

router.post("/orders", createOrder);
router.post("/payment", processPayment);
router.get("/orders/:id", getOrder);

export default router;