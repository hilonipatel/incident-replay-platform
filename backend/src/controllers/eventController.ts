import { Request, Response, NextFunction } from "express";
import * as service from "../services/eventService";

export async function createEvent(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const incidentId = Number(req.params.id);
    const event = await service.createEvent(incidentId, req.body);

    res.status(201).json({ data: event });
  } catch (error) {
    next(error);
  }
}

export async function listEvents(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const incidentId = Number(req.params.id);
    const events = await service.listEvents(incidentId);

    res.json({ data: events });
  } catch (error) {
    next(error);
  }
}