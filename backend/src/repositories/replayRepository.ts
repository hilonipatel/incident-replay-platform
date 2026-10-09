import { pool } from "../db/pool";

export async function createReplayRun(incidentId: number) {
  const result = await pool.query(
    `INSERT INTO replay_runs (incident_id, status)
     VALUES ($1, 'running')
     RETURNING *`,
    [incidentId]
  );

  return result.rows[0];
}

export async function saveReplayResult(input: {
  replayRunId: string;
  eventId: string;
  actualStatus: number | null;
  actualResponseBody: unknown;
  durationMs: number;
  result: "PASS" | "FAIL";
  errorMessage: string | null;
}) {
  const result = await pool.query(
    `INSERT INTO replay_results (
      replay_run_id,
      incident_event_id,
      actual_status,
      actual_response_body,
      duration_ms,
      result,
      error_message
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *`,
    [
      input.replayRunId,
      input.eventId,
      input.actualStatus,
      input.actualResponseBody === null
        ? null
        : JSON.stringify(input.actualResponseBody),
      input.durationMs,
      input.result,
      input.errorMessage,
    ]
  );

  return result.rows[0];
}

export async function finishReplayRun(
  replayRunId: string,
  status: "completed" | "failed"
) {
  await pool.query(
    `UPDATE replay_runs
     SET status = $1, completed_at = NOW()
     WHERE id = $2`,
    [status, replayRunId]
  );
}

export async function getReplayRun(
  incidentId: number,
  replayRunId: string
) {
  const run = await pool.query(
    `SELECT * FROM replay_runs
     WHERE id = $1 AND incident_id = $2`,
    [replayRunId, incidentId]
  );

  if (run.rows.length === 0) return null;

  const results = await pool.query(
    `SELECT rr.*, ie.sequence_number, ie.method, ie.path,
            ie.expected_status, ie.expected_response_body
     FROM replay_results rr
     JOIN incident_events ie ON ie.id = rr.incident_event_id
     WHERE rr.replay_run_id = $1
     ORDER BY ie.sequence_number`,
    [replayRunId]
  );

  return {
    ...run.rows[0],
    results: results.rows,
  };
}