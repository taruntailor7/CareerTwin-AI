import { Router, type Request, type Response } from "express";
import { store } from "../../lib/store.js";
import { type AuthenticatedRequest } from "../../middleware/auth.js";

export const dashboardRouter = Router();

dashboardRouter.get("/:profileId", (req: Request, res: Response) => {
  const profile = store.getProfile(String(req.params.profileId));
  if (!profile || profile.clerkUserId !== (req as AuthenticatedRequest).authUserId) {
    return res.status(404).json({ error: "Profile not found for dashboard." });
  }

  const latestTwin = store.latestTwinForProfile(profile.id);
  const simulations = store.listSimulations(profile.id);
  const latestSimulation = simulations.at(-1) ?? null;
  const reports = store.listReports(profile.id);
  const analyses = store.listAnalyses(profile.id);
  const averageAnalysisScore = analyses.length
    ? Math.round(analyses.reduce((sum, analysis) => sum + analysis.score, 0) / analyses.length)
    : null;

  return res.status(200).json({
    data: {
      profile,
      latestTwin,
      latestSimulation,
      analysisCount: analyses.length,
      averageAnalysisScore,
      reportCount: reports.length,
      nextActions: [
        averageAnalysisScore !== null && averageAnalysisScore < 70
          ? "Improve weak career signals by updating resume and portfolio evidence."
          : "Review assumptions with lowest confidence.",
        "Run one additional scenario with altered location preference.",
        analyses.length < 2
          ? "Add at least two analysis sources (resume + GitHub/portfolio) to improve confidence."
          : "Generate a mentor-ready report for feedback."
      ]
    }
  });
});
