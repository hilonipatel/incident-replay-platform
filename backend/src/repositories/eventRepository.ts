import { pool } from "../db/pool";

export interface CreateEventInput {
  sequenceNumber: number;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  headers?: Record<string, string>;
  requestBody?: unknown;
  expectedStatus: number;
  expectedResponseBody?: unknown;
}

export async function createEvent(
  incidentId: number,
  input: CreateEventInput
) {
  const result = await pool.query(
    `INSERT INTO incident_events (
      incident_id, sequence_number, method, path, headers,
      request_body, expected_status, expected_response_body
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
    [
      incidentId,
      input.sequenceNumber,
      input.method,
      input.path,
      JSON.stringify(input.headers ?? {}),
      input.requestBody === undefined
        ? null
        : JSON.stringify(input.requestBody),
      input.expectedStatus,
      input.expectedResponseBody === undefined
        ? null
        : JSON.stringify(input.expectedResponseBody),
    ]
  );

  return result.rows[0];
}

export async function listEvents(incidentId: number) {
  const result = await pool.query(
    `SELECT * FROM incident_events
     WHERE incident_id = $1
     ORDER BY sequence_number ASC`,
    [incidentId]
  );

  return result.rows;
}