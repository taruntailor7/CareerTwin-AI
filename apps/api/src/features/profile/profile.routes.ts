import { Router, type Request, type Response } from "express";
import { store } from "../../lib/store.js";
import { type AuthenticatedRequest } from "../../middleware/auth.js";
import { upsertProfileSchema } from "./profile.schemas.js";

export const profileRouter = Router();

profileRouter.get("/", (req: Request, res: Response) => {
  const profiles = store.listProfilesByUser((req as AuthenticatedRequest).authUserId);
  return res.status(200).json({ data: profiles });
});

profileRouter.get("/:profileId", (req: Request, res: Response) => {
  const profile = store.getProfile(String(req.params.profileId));
  if (!profile || profile.clerkUserId !== (req as AuthenticatedRequest).authUserId) {
    return res.status(404).json({ error: "Profile not found." });
  }
  return res.status(200).json({ data: profile });
});

profileRouter.post("/", (req: Request, res: Response) => {
  const parsed = upsertProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid profile payload.", details: parsed.error.flatten() });
  }
  const profile = store.createProfile({
    ...parsed.data,
    label: parsed.data.label?.trim() || parsed.data.currentRole,
    clerkUserId: (req as AuthenticatedRequest).authUserId
  });
  return res.status(201).json({ data: profile });
});

profileRouter.put("/:profileId", (req: Request, res: Response) => {
  const parsed = upsertProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid profile payload.", details: parsed.error.flatten() });
  }
  const profile = store.updateProfile(String(req.params.profileId), (req as AuthenticatedRequest).authUserId, {
    ...parsed.data,
    label: parsed.data.label?.trim() || parsed.data.currentRole
  });
  if (!profile) {
    return res.status(404).json({ error: "Profile not found." });
  }
  return res.status(200).json({ data: profile });
});
