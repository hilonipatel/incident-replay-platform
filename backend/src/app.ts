import express, { ErrorRequestHandler } from "express";
import cors from "cors";
import incidentRoutes from "./routes/incidentRoutes";
import demoRoutes from "./routes/demoRoutes";

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Incident Replay API is running",
  });
});

app.use("/api/incidents", incidentRoutes);
app.use("/api/demo", demoRoutes);

app.use((_req, res) => {
  res.status(404).json({
    error: { message: "Route not found" },
  });
});

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const statusCode =
    Number.isInteger(err.statusCode) &&
    err.statusCode >= 400 &&
    err.statusCode < 500
      ? err.statusCode
      : 500;

  if (statusCode === 500) {
    console.error(err);
  }

  res.status(statusCode).json({
    error: {
      message:
        statusCode === 500
          ? "Internal server error"
          : err.message,
    },
  });
};

app.use(errorHandler);

export default app;