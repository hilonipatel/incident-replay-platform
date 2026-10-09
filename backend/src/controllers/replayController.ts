import { Request, Response, NextFunction } from "express";
import * as service from "../services/replayService";

export async function replayIncident(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const incidentId = Number(req.params.id);
    const summary = await service.replayIncident(incidentId);

    res.status(201).json({ data: summary });
  } catch (error) {
    next(error);
  }
}

export async function getReplayResults(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const incidentId = Number(req.params.id);
    const replayId = req.params.replayId;

    if (typeof replayId !== "string") {
      res.status(400).json({
        error: { message: "Invalid replay ID" },
      });
      return;
    }

    const replay = await service.getReplayResults(
      incidentId,
      replayId
    );

    res.json({ data: replay });
  } catch (error) {
    next(error);
  }
}