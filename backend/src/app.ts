import express from "express";
import type { DB } from "./db";
import { errorHandler } from "./errors";
import { debtorsRouter } from "./routes/debtors";
import { studentsRouter } from "./routes/students";

export function createApp(db: DB) {
  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });
  app.use("/students", studentsRouter(db));
  app.use("/debtors", debtorsRouter(db));

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });
  app.use(errorHandler);

  return app;
}
