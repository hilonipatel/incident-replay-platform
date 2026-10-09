import { Request, Response, NextFunction } from "express";
import * as service from "../services/incidentService";

export async function createIncident(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const incident = await service.createIncident(req.body);
    res.status(201).json({ data: incident });
  } catch (error) {
    next(error);
  }
}

export async function listIncidents(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const incidents = await service.listIncidents();
    res.json({ data: incidents });
  } catch (error) {
    next(error);
  }
}

export async function getIncident(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id < 1) {
      res.status(400).json({
        error: { message: "Invalid incident ID" },
      });
      return;
    }

    const incident = await service.getIncident(id);
    res.json({ data: incident });
  } catch (error) {
    next(error);
  }
}