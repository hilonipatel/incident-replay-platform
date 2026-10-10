const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5001/api";

export interface Incident {
  id: number | string;
  title: string;
  description?: string;
  severity: string;
  status: string;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
}

export interface IncidentEvent {
    id: number;
    incident_id: number;
    sequence_number: number;
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    path: string;
    headers: Record<string, string>;
    request_body: unknown;
    expected_status: number;
    expected_response_body: unknown;
    created_at?: string;
  }

export interface CreateIncidentInput {
  title: string;
  description?: string;
  severity: "low" | "medium" | "high" | "critical";
}

export interface CreateIncidentEventInput {
  sequenceNumber: number;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  headers?: Record<string, string>;
  requestBody?: unknown;
  expectedStatus: number;
  expectedResponseBody?: unknown;
}

export interface ReplayResult {
  id?: number | string;
  incident_event_id?: number | string;
  eventId: number | string;
  sequenceNumber: number;
  method: string;
  path: string;
  expectedStatus: number;
  actualStatus: number | null;
  expectedResponseBody?: unknown;
  actualResponseBody?: unknown;
  durationMs: number;
  result: "PASS" | "FAIL";
  errorMessage?: string | null;
}
  
export interface ReplayRun {
    replayId: string;
    incidentId: string;
    status: "running" | "completed" | "failed";
    total: number;
    passed: number;
    failed: number;
    results: ReplayResult[];
}

async function readResponse(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

function getErrorMessage(
  result: unknown,
  fallback: string
): string {
  if (typeof result !== "object" || result === null) {
    return fallback;
  }

  if ("error" in result) {
    const error = result.error;

    if (typeof error === "string") {
      return error;
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string"
    ) {
      return error.message;
    }
  }

  if ("message" in result && typeof result.message === "string") {
    return result.message;
  }

  return fallback;
}

function unwrapData<T>(
  result: unknown,
  description: string
): T {
  if (
    typeof result === "object" &&
    result !== null &&
    "data" in result
  ) {
    return result.data as T;
  }

  throw new Error(
    `Unexpected response from the ${description} API.`
  );
}

export async function getIncidents(): Promise<Incident[]> {
  const response = await fetch(`${API_BASE_URL}/incidents`);
  const result = await readResponse(response);

  if (!response.ok) {
    throw new Error(
      getErrorMessage(
        result,
        `Failed to load incidents (${response.status})`
      )
    );
  }

  if (Array.isArray(result)) {
    return result as Incident[];
  }

  if (
    typeof result === "object" &&
    result !== null &&
    "data" in result &&
    Array.isArray(result.data)
  ) {
    return result.data as Incident[];
  }

  if (
    typeof result === "object" &&
    result !== null &&
    "incidents" in result &&
    Array.isArray(result.incidents)
  ) {
    return result.incidents as Incident[];
  }

  throw new Error("Unexpected response from the incidents API.");
}

export async function createIncident(
  input: CreateIncidentInput
): Promise<Incident> {
  const response = await fetch(`${API_BASE_URL}/incidents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: input.title.trim(),
      description: input.description?.trim() ?? "",
      severity: input.severity,
    }),
  });

  const result = await readResponse(response);

  if (!response.ok) {
    throw new Error(
      getErrorMessage(
        result,
        `Failed to create incident (${response.status})`
      )
    );
  }

  const incident = unwrapData<Incident>(result, "incidents");

  if (
    !incident ||
    typeof incident !== "object" ||
    incident.id === undefined ||
    typeof incident.title !== "string"
  ) {
    throw new Error("The API returned an invalid incident.");
  }

  return incident;
}

export async function getIncidentEvents(
  incidentId: string | number
): Promise<IncidentEvent[]> {
  const response = await fetch(
    `${API_BASE_URL}/incidents/${encodeURIComponent(String(incidentId))}/events`
  );

  const result = await readResponse(response);

  if (!response.ok) {
    throw new Error(
      getErrorMessage(
        result,
        `Failed to load events (${response.status})`
      )
    );
  }

  return unwrapData<IncidentEvent[]>(result, "events");
}

export async function createIncidentEvent(
  incidentId: string | number,
  input: CreateIncidentEventInput
): Promise<IncidentEvent> {
  const response = await fetch(
    `${API_BASE_URL}/incidents/${encodeURIComponent(String(incidentId))}/events`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    }
  );

  const result = await readResponse(response);

  if (!response.ok) {
    throw new Error(
      getErrorMessage(
        result,
        `Failed to create event (${response.status})`
      )
    );
  }

  return unwrapData<IncidentEvent>(result, "events");
}

export async function runIncidentReplay(
    incidentId: string | number
  ): Promise<ReplayRun> {
    const response = await fetch(
      `${API_BASE_URL}/incidents/${encodeURIComponent(
        String(incidentId)
      )}/replays`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  
    const result = await readResponse(response);
  
    if (!response.ok) {
      throw new Error(
        getErrorMessage(
          result,
          `Failed to run replay (${response.status})`
        )
      );
    }
  
    return unwrapData<ReplayRun>(result, "replay");
  }

export async function getReplayResults(
  incidentId: string | number,
  replayId: string
): Promise<ReplayRun> {
  const response = await fetch(
    `${API_BASE_URL}/incidents/${encodeURIComponent(
      String(incidentId)
    )}/replays/${encodeURIComponent(replayId)}`
  );

  const result = await readResponse(response);

  if (!response.ok) {
    throw new Error(
      getErrorMessage(
        result,
        `Failed to load replay results (${response.status})`
      )
    );
  }

  const replay = unwrapData<{
    id: number | string;
    incident_id: number | string;
    status: "running" | "completed" | "failed";
    results: Array<{
      id: number | string;
      incident_event_id: number | string;
      sequence_number: number;
      method: string;
      path: string;
      expected_status: number;
      actual_status: number | null;
      expected_response_body: unknown;
      actual_response_body: unknown;
      duration_ms: number;
      result: "PASS" | "FAIL";
      error_message: string | null;
    }>;
  }>(result, "replay results");

  return {
    replayId: String(replay.id),
    incidentId: String(replay.incident_id),
    status: replay.status,
    total: replay.results.length,
    passed: replay.results.filter(
      (item) => item.result === "PASS"
    ).length,
    failed: replay.results.filter(
      (item) => item.result === "FAIL"
    ).length,
    results: replay.results.map((item) => ({
      id: item.id,
      eventId: item.incident_event_id,
      sequenceNumber: item.sequence_number,
      method: item.method,
      path: item.path,
      expectedStatus: item.expected_status,
      actualStatus: item.actual_status,
      expectedResponseBody: item.expected_response_body,
      actualResponseBody: item.actual_response_body,
      durationMs: item.duration_ms,
      result: item.result,
      errorMessage: item.error_message,
    })),
  };
}