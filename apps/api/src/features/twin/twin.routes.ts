import { Router, type Request, type Response } from "express";
import { buildTwinWithAi, computeDataCompleteness } from "../ai/ai.service.js";
import { store } from "../../lib/store.js";
import { type AuthenticatedRequest } from "../../middleware/auth.js";
import { buildTwinSchema } from "./twin.schemas.js";

export const twinRouter = Router();

twinRouter.post("/build", async (req: Request, res: Response) => {
  const parsed = buildTwinSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid twin build request.", details: parsed.error.flatten() });
  }

  const profile = store.getProfile(parsed.data.profileId);
  if (!profile) {
    return res.status(404).json({ error: "Profile not found for twin generation." });
  }
  if (profile.clerkUserId !== (req as AuthenticatedRequest).authUserId) {
    return res.status(403).json({ error: "Forbidden profile access." });
  }

  const analyses = store.listAnalyses(profile.id);
  const latestSimulation = store.listSimulations(profile.id).at(-1) ?? null;
  const aiTwin = await buildTwinWithAi(profile, analyses, latestSimulation);

  const twin = store.saveTwin({
    profileId: profile.id,
    summary: aiTwin.summary,
    strengths: aiTwin.strengths,
    growthAreas: aiTwin.growthAreas,
    careerArchetype: aiTwin.careerArchetype,
    marketPositioning: aiTwin.marketPositioning,
    recommendedNextSteps: aiTwin.recommendedNextSteps,
    dataCompleteness: computeDataCompleteness(profile, analyses),
    confidence: aiTwin.confidenceBand
  });

  return res.status(201).json({ data: twin });
});

twinRouter.get("/latest/:profileId", (req: Request, res: Response) => {
  const profileId = String(req.params.profileId);
  const profile = store.getProfile(profileId);
  if (!profile || profile.clerkUserId !== (req as AuthenticatedRequest).authUserId) {
    return res.status(403).json({ error: "Forbidden profile access." });
  }
  const twin = store.latestTwinForProfile(profileId);
  if (!twin) {
    return res.status(404).json({ error: "No twin found for profile." });
  }
  return res.status(200).json({ data: twin });
});
