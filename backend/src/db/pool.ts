import "dotenv/config";
import { Pool } from "pg";

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://localhost:5432/incident_replay",
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error:", error);
});