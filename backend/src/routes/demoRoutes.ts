import { Router } from "express";
import {
  createOrder,
  processPayment,
  getOrder,
  getOrders,
} from "../controllers/demoController";

const router = Router();

router.post("/orders", createOrder);
router.get("/orders", getOrders)
router.post("/payment", processPayment);
router.get("/orders/:id", getOrder);

export default router;