import * as repository from "../repositories/incidentRepository";

const validSeverities = ["low", "medium", "high", "critical"];

export async function createIncident(
  input: repository.CreateIncidentInput
) {
  if (!input.title?.trim()) {
    throw Object.assign(new Error("Title is required"), {
      statusCode: 400,
    });
  }

  if (input.title.trim().length > 200) {
    throw Object.assign(new Error("Title must be 200 characters or fewer"), {
      statusCode: 400,
    });
  }

  if (
    input.severity !== undefined &&
    !validSeverities.includes(input.severity)
  ) {
    throw Object.assign(new Error("Invalid severity"), {
      statusCode: 400,
    });
  }

  return repository.createIncident({
    title: input.title.trim(),
    description: input.description,
    severity: input.severity,
  });
}

export async function listIncidents() {
  return repository.listIncidents();
}

export async function getIncident(id: number) {
  const incident = await repository.findIncidentById(id);

  if (!incident) {
    throw Object.assign(new Error("Incident not found"), {
      statusCode: 404,
    });
  }

  return incident;
}