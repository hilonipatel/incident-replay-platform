import { pool } from "../db/pool";

export interface Incident {
  id: number;
  title: string;
  description: string;
  severity: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateIncidentInput {
  title: string;
  description?: string;
  severity?: string;
}

export async function createIncident(
  input: CreateIncidentInput
): Promise<Incident> {
  const result = await pool.query<Incident>(
    `INSERT INTO incidents (title, description, severity)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [
      input.title,
      input.description ?? "",
      input.severity ?? "medium",
    ]
  );

  return result.rows[0];
}

export async function listIncidents(): Promise<Incident[]> {
  const result = await pool.query<Incident>(
    `SELECT * FROM incidents ORDER BY created_at DESC`
  );

  return result.rows;
}

export async function findIncidentById(
  id: number
): Promise<Incident | null> {
  const result = await pool.query<Incident>(
    `SELECT * FROM incidents WHERE id = $1`,
    [id]
  );

  return result.rows[0] ?? null;
}