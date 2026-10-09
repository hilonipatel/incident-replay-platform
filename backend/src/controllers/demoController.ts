import { Request, Response } from "express";

interface Order {
  id: string;
  item: string;
}

const orders = new Map<string, Order>();
let nextOrderId = 1;

export function createOrder(req: Request, res: Response) {
  const { item } = req.body ?? {};

  if (typeof item !== "string" || !item.trim()) {
    res.status(400).json({
      error: "A valid item is required",
    });
    return;
  }

  const id = String(nextOrderId++);
  const order = { id, item: item.trim() };

  orders.set(id, order);

  res.status(201).json({
    status: "created",
    order,
  });
}

export function processPayment(req: Request, res: Response) {
  const { amount } = req.body ?? {};

  if (typeof amount !== "number" || amount <= 0) {
    res.status(400).json({
      error: "Amount must be a positive number",
    });
    return;
  }

  if (amount === 9999) {
    res.status(500).json({
      error: "Payment service unavailable",
    });
    return;
  }

  res.status(200).json({
    status: "payment_successful",
  });
}

export function getOrder(req: Request, res: Response) {
    const id = req.params.id;
  
    if (typeof id !== "string") {
      res.status(400).json({
        error: "Invalid order ID",
      });
      return;
    }
  
    const order = orders.get(id);
  
    if (!order) {
      res.status(404).json({
        error: "Order not found",
      });
      return;
    }
  
    res.status(200).json({
      order,
    });
  }