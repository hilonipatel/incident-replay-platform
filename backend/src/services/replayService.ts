import { pool } from "../db/pool";
import * as incidentRepository from "../repositories/incidentRepository";
import * as replayRepository from "../repositories/replayRepository";

const PORT = Number(process.env.PORT) || 5001;

// This is intentionally fixed to the local demo service.
const DEMO_BASE_URL = `http://127.0.0.1:${PORT}`;

function matchesExpected(
  expected: unknown,
  actual: unknown
): boolean {
  if (
    expected === null ||
    typeof expected !== "object" ||
    Array.isArray(expected)
  ) {
    return JSON.stringify(expected) === JSON.stringify(actual);
  }

  if (
    actual === null ||
    typeof actual !== "object" ||
    Array.isArray(actual)
  ) {
    return false;
  }

  return Object.entries(expected as Record<string, unknown>).every(
    ([key, value]) =>
      Object.prototype.hasOwnProperty.call(actual, key) &&
      matchesExpected(
        value,
        (actual as Record<string, unknown>)[key]
      )
  );
}

export async function replayIncident(incidentId: number) {
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

  const eventsResult = await pool.query(
    `SELECT * FROM incident_events
     WHERE incident_id = $1
     ORDER BY sequence_number ASC`,
    [incidentId]
  );

  const events = eventsResult.rows;

  if (events.length === 0) {
    throw Object.assign(
      new Error("Cannot replay an incident with no events"),
      { statusCode: 400 }
    );
  }

  const run = await replayRepository.createReplayRun(incidentId);

  let passed = 0;
  let failed = 0;

  try {
    for (const event of events) {
      const started = Date.now();

      let actualStatus: number | null = null;
      let actualBody: unknown = null;
      let errorMessage: string | null = null;
      let result: "PASS" | "FAIL" = "FAIL";

      try {
        // Defense in depth: never replay paths outside the demo API.
        if (
          typeof event.path !== "string" ||
          !/^\/api\/demo\/[a-zA-Z0-9/_-]*$/.test(event.path)
        ) {
          throw new Error("Replay path is not allowed");
        }

        const hasBody =
          event.request_body !== null &&
          event.request_body !== undefined;

        const response = await fetch(
          `${DEMO_BASE_URL}${event.path}`,
          {
            method: event.method,
            headers: hasBody
              ? { "Content-Type": "application/json" }
              : undefined,
            body: hasBody
              ? JSON.stringify(event.request_body)
              : undefined,
            signal: AbortSignal.timeout(5000),
            redirect: "error",
          }
        );

        actualStatus = response.status;

        const text = await response.text();

        try {
          actualBody = text ? JSON.parse(text) : null;
        } catch {
          actualBody = text;
        }

        const statusMatches =
          actualStatus === Number(event.expected_status);

        const bodyMatches =
          event.expected_response_body == null ||
          matchesExpected(event.expected_response_body, actualBody);

        result = statusMatches && bodyMatches ? "PASS" : "FAIL";
      } catch (error) {
        errorMessage =
          error instanceof Error ? error.message : "Unknown replay error";
      }

      const durationMs = Date.now() - started;

      await replayRepository.saveReplayResult({
        replayRunId: String(run.id),
        eventId: String(event.id),
        actualStatus,
        actualResponseBody: actualBody,
        durationMs,
        result,
        errorMessage,
      });

      if (result === "PASS") passed++;
      else failed++;
    }

    await replayRepository.finishReplayRun(
      String(run.id),
      "completed"
    );

    return {
      replayId: String(run.id),
      incidentId: String(incidentId),
      status: "completed",
      total: events.length,
      passed,
      failed,
    };
  } catch (error) {
    await replayRepository.finishReplayRun(
      String(run.id),
      "failed"
    );

    throw error;
  }
}

export async function getReplayResults(
  incidentId: number,
  replayId: string
) {
  if (
    !Number.isSafeInteger(incidentId) ||
    incidentId < 1 ||
    !/^[1-9]\d*$/.test(replayId)
  ) {
    throw Object.assign(new Error("Invalid incident or replay ID"), {
      statusCode: 400,
    });
  }

  const replay = await replayRepository.getReplayRun(
    incidentId,
    replayId
  );

  if (!replay) {
    throw Object.assign(new Error("Replay run not found"), {
      statusCode: 404,
    });
  }

  return replay;
}

export async function listReplayHistory(incidentId: number) {
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

  const result = await pool.query(
    `SELECT
       rr.id::text AS id,
       rr.incident_id::text AS incident_id,
       rr.started_at,
       rr.completed_at,
       rr.status,
       COUNT(res.id)::int AS total_requests,
       COUNT(res.id) FILTER (
         WHERE res.result = 'PASS'
       )::int AS passed,
       COUNT(res.id) FILTER (
         WHERE res.result = 'FAIL'
       )::int AS failed,
       COALESCE(
         ROUND(
           100.0 * COUNT(res.id) FILTER (
             WHERE res.result = 'PASS'
           ) / NULLIF(COUNT(res.id), 0),
           1
         ),
         0
       ) AS pass_rate
     FROM replay_runs rr
     LEFT JOIN replay_results res
       ON res.replay_run_id = rr.id
     WHERE rr.incident_id = $1
     GROUP BY rr.id
     ORDER BY rr.started_at DESC, rr.id DESC`,
    [incidentId]
  );

  return result.rows;
}