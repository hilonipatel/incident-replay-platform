import { z } from "zod";
import * as incidentRepository from "../repositories/incidentRepository";
import * as eventRepository from "../repositories/eventRepository";

const eventSchema = z.object({
  sequenceNumber: z.number().int().positive(),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  path: z.string().regex(
    /^\/api\/demo\/[a-zA-Z0-9/_-]*$/,
    "Path must be a local demo API path"
  ),
  headers: z.record(z.string(), z.string()).optional(),
  requestBody: z.unknown().optional(),
  expectedStatus: z.number().int().min(100).max(599),
  expectedResponseBody: z.unknown().optional(),
});

export async function createEvent(
  incidentId: number,
  input: unknown
) {
  if (!Number.isSafeInteger(incidentId) || incidentId < 1) {
    throw Object.assign(new Error("Invalid incident ID"), {
      statusCode: 400,
    });
  }

  const incident =
    await incidentRepository.findIncidentById(incidentId);

  if (!incident) {
    throw Object.assign(new Error("Incident not found"), {
      statusCode: 404,
    });
  }

  const parsed = eventSchema.safeParse(input);

  if (!parsed.success) {
    throw Object.assign(
      new Error(parsed.error.issues.map((issue) => issue.message).join("; ")),
      { statusCode: 400 }
    );
  }

  try {
    return await eventRepository.createEvent(
      incidentId,
      parsed.data
    );
  } catch (error: unknown) {
    const dbError = error as { code?: string };

    if (dbError.code === "23505") {
      throw Object.assign(
        new Error("Sequence number already exists for this incident"),
        { statusCode: 409 }
      );
    }

    throw error;
  }
}

export async function listEvents(incidentId: number) {
  if (!Number.isSafeInteger(incidentId) || incidentId < 1) {
    throw Object.assign(new Error("Invalid incident ID"), {
      statusCode: 400,
    });
  }

  const incident =
    await incidentRepository.findIncidentById(incidentId);

  if (!incident) {
    throw Object.assign(new Error("Incident not found"), {
      statusCode: 404,
    });
  }

  return eventRepository.listEvents(incidentId);
}