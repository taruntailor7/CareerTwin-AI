import { Router, type Request, type Response } from "express";
import { runSimulationWithAi, suggestScenariosWithAi } from "../ai/ai.service.js";
import { store } from "../../lib/store.js";
import { type AuthenticatedRequest } from "../../middleware/auth.js";
import { runSimulationSchema, suggestScenariosSchema } from "./simulation.schemas.js";

export const simulationRouter = Router();

simulationRouter.post("/suggest", async (req: Request, res: Response) => {
  const parsed = suggestScenariosSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid scenario suggestion request.", details: parsed.error.flatten() });
  }

  const profile = store.getProfile(parsed.data.profileId);
  if (!profile) {
    return res.status(404).json({ error: "Profile not found for scenario suggestions." });
  }
  if (profile.clerkUserId !== (req as AuthenticatedRequest).authUserId) {
    return res.status(403).json({ error: "Forbidden profile access." });
  }

  const suggestions = await suggestScenariosWithAi(profile);
  return res.status(200).json({ data: suggestions });
});

simulationRouter.post("/run", async (req: Request, res: Response) => {
  const parsed = runSimulationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid simulation payload.", details: parsed.error.flatten() });
  }

  const profile = store.getProfile(parsed.data.profileId);
  if (!profile) {
    return res.status(404).json({ error: "Profile not found for simulation." });
  }
  if (profile.clerkUserId !== (req as AuthenticatedRequest).authUserId) {
    return res.status(403).json({ error: "Forbidden profile access." });
  }

  const analysisCount = store.listAnalyses(profile.id).length;
  const interviewSession = store.getInterviewSession(profile.id);
  const interviewAnswerCount = interviewSession?.answered.length ?? 0;

  const aiResult = await runSimulationWithAi(profile, parsed.data.scenarios, { analysisCount, interviewAnswerCount });
  const simulation = store.saveSimulation({
    profileId: profile.id,
    recommendation: aiResult.recommendation,
    assumptions: aiResult.assumptions,
    tradeoffs: aiResult.tradeoffs,
    timeline: aiResult.timeline,
    actionPlan: aiResult.actionPlan,
    marketDemand: aiResult.marketDemand,
    lifestyleImpact: aiResult.lifestyleImpact,
    confidenceNarrative: aiResult.confidenceNarrative,
    confidenceBand: aiResult.confidenceBand,
    scenarios: aiResult.scenarios,
    evidenceRefs: aiResult.evidenceRefs
  });

  return res.status(201).json({ data: simulation });
});

simulationRouter.get("/profile/:profileId", (req: Request, res: Response) => {
  const profile = store.getProfile(String(req.params.profileId));
  if (!profile || profile.clerkUserId !== (req as AuthenticatedRequest).authUserId) {
    return res.status(403).json({ error: "Forbidden profile access." });
  }
  const data = store.listSimulations(profile.id);
  return res.status(200).json({ data });
});

simulationRouter.get("/compare/:profileId", (req: Request, res: Response) => {
  const profile = store.getProfile(String(req.params.profileId));
  if (!profile || profile.clerkUserId !== (req as AuthenticatedRequest).authUserId) {
    return res.status(403).json({ error: "Forbidden profile access." });
  }

  const comparison = store.buildScenarioComparison(profile.id);
  if (!comparison) {
    return res.status(404).json({ error: "No simulations found to compare yet." });
  }

  return res.status(200).json({ data: comparison });
});

simulationRouter.get("/:simulationId", (req: Request, res: Response) => {
  const simulation = store.getSimulation(String(req.params.simulationId));
  if (!simulation) {
    return res.status(404).json({ error: "Simulation not found." });
  }
  const profile = store.getProfile(simulation.profileId);
  if (!profile || profile.clerkUserId !== (req as AuthenticatedRequest).authUserId) {
    return res.status(403).json({ error: "Forbidden profile access." });
  }
  return res.status(200).json({ data: simulation });
});
