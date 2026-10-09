import { pool } from "./pool";

async function main() {
  try {
    const result = await pool.query(
      "SELECT current_database() AS database"
    );

    console.log("Connected to PostgreSQL:", result.rows[0].database);
  } catch (error) {
    console.error("Database connection failed:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main();