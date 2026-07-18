import cors from "cors";
import express, { type Request, type Response } from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { analysisRouter } from "./features/analysis/analysis.routes.js";
import { dashboardRouter } from "./features/dashboard/dashboard.routes.js";
import { importRouter } from "./features/import/import.routes.js";
import { interviewRouter } from "./features/interview/interview.routes.js";
import { profileRouter } from "./features/profile/profile.routes.js";
import { reportRouter } from "./features/reports/report.routes.js";
import { simulationRouter } from "./features/simulations/simulation.routes.js";
import { twinRouter } from "./features/twin/twin.routes.js";
import { logger } from "./lib/logger.js";
import { requireUserAuth } from "./middleware/auth.js";

export const app = express();

app.use(
  cors({
    origin: env.NEXT_PUBLIC_APP_URL ?? true,
    credentials: true
  })
);
app.use(helmet());
app.use(express.json({ limit: "1mb" }));
app.use((req: Request, _res: Response, next) => {
  logger.debug({ method: req.method, path: req.path }, "Incoming request");
  next();
});

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    service: "careertwin-api",
    timestamp: new Date().toISOString()
  });
});

app.get("/api/v1/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", version: "v1" });
});

app.use("/api/v1", requireUserAuth);
app.use("/api/v1/profiles", profileRouter);
app.use("/api/v1/twin", twinRouter);
app.use("/api/v1/simulations", simulationRouter);
app.use("/api/v1/analysis", analysisRouter);
app.use("/api/v1/import", importRouter);
app.use("/api/v1/interview", interviewRouter);
app.use("/api/v1/reports", reportRouter);
app.use("/api/v1/dashboard", dashboardRouter);
