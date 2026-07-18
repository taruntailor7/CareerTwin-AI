import { Router, type Request, type Response } from "express";
import { store } from "../../lib/store.js";
import { type AuthenticatedRequest } from "../../middleware/auth.js";
import { buildReportPdfStream } from "../../services/pdf.service.js";
import { buildCareerScorecard } from "../../services/scorecard.service.js";
import { generateReportSchema } from "./report.schemas.js";
import { deriveReportSections } from "./report.service.js";

export const reportRouter = Router();

reportRouter.post("/generate", (req: Request, res: Response) => {
  const parsed = generateReportSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid report request.", details: parsed.error.flatten() });
  }

  const profile = store.getProfile(parsed.data.profileId);
  const simulation = store.getSimulation(parsed.data.simulationId);
  if (!profile || !simulation) {
    return res.status(404).json({ error: "Profile or simulation not found for report generation." });
  }
  if (profile.clerkUserId !== (req as AuthenticatedRequest).authUserId) {
    return res.status(403).json({ error: "Forbidden profile access." });
  }

  const report = store.saveReport({
    profileId: profile.id,
    simulationId: simulation.id,
    title: parsed.data.title,
    audience: parsed.data.audience,
    summary: `${simulation.recommendation} | Confidence ${simulation.confidenceBand.min.toFixed(2)}-${simulation.confidenceBand.max.toFixed(2)}`
  });

  return res.status(201).json({ data: report });
});

reportRouter.get("/:reportId/detail", (req: Request, res: Response) => {
  const reportId = String(req.params.reportId);
  const report = store.getReport(reportId);

  if (!report) {
    return res.status(404).json({ error: "Report not found." });
  }

  const profile = store.getProfile(report.profileId);
  const simulation = store.getSimulation(report.simulationId);
  if (!profile || !simulation || profile.clerkUserId !== (req as AuthenticatedRequest).authUserId) {
    return res.status(403).json({ error: "Forbidden profile access." });
  }

  const { bestScenario, strengths, risks } = deriveReportSections(profile, simulation);

  return res.status(200).json({
    data: {
      report,
      sections: {
        executiveSummary: report.summary,
        strengths,
        risks,
        evidence: simulation.evidenceRefs,
        scenarioHighlight: bestScenario
          ? {
              name: bestScenario.name,
              successProbability: bestScenario.successProbability,
              salaryProjection: bestScenario.salaryProjection,
              timelineToGoal: bestScenario.timelineToGoal
            }
          : null,
        actionPlan90Days: simulation.actionPlan.length ? simulation.actionPlan : simulation.timeline
      }
    }
  });
});

reportRouter.get("/:reportId/pdf", (req: Request, res: Response) => {
  const reportId = String(req.params.reportId);
  const report = store.getReport(reportId);
  if (!report) {
    return res.status(404).json({ error: "Report not found." });
  }

  const profile = store.getProfile(report.profileId);
  const simulation = store.getSimulation(report.simulationId);
  if (!profile || !simulation || profile.clerkUserId !== (req as AuthenticatedRequest).authUserId) {
    return res.status(403).json({ error: "Forbidden profile access." });
  }

  const scorecard = buildCareerScorecard(profile, store.listAnalyses(profile.id));
  const pdf = buildReportPdfStream({ report, profile, simulation, scorecard });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="careertwin-report-${report.id}.pdf"`);
  pdf.pipe(res);

  return undefined;
});

reportRouter.get("/profile/:profileId", (req: Request, res: Response) => {
  const profile = store.getProfile(String(req.params.profileId));
  if (!profile || profile.clerkUserId !== (req as AuthenticatedRequest).authUserId) {
    return res.status(403).json({ error: "Forbidden profile access." });
  }
  return res.status(200).json({ data: store.listReports(profile.id) });
});
