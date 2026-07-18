import multer from "multer";
import { Router, type Request, type Response } from "express";
import { env } from "../../config/env.js";
import { extractProfileFromText } from "../ai/ai.service.js";
import { store } from "../../lib/store.js";
import { type AuthenticatedRequest } from "../../middleware/auth.js";
import { analyzeGithubProfile } from "../../services/github.service.js";
import { analyzePortfolio } from "../../services/portfolio.service.js";
import { extractTextFromFile, isSupportedImportMimeType } from "../../services/extraction.service.js";
import { importGithubSchema, importPortfolioSchema } from "./import.schemas.js";

export const importRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }
});

importRouter.post("/resume", upload.single("file"), async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: "No file uploaded. Attach a PDF, DOCX, or image under the 'file' field." });
  }
  if (!isSupportedImportMimeType(file.mimetype)) {
    return res.status(415).json({ error: `Unsupported file type: ${file.mimetype}. Use PDF, DOCX, PNG, JPEG, or WEBP.` });
  }

  const rawText = await extractTextFromFile(file.buffer, file.mimetype);
  if (!rawText.trim()) {
    return res.status(422).json({
      error: "Could not extract any readable text from this file. Try a clearer scan or a text-based PDF/DOCX."
    });
  }

  const draft = await extractProfileFromText(rawText);
  const upload_ = store.saveResumeUpload({
    clerkUserId: (req as AuthenticatedRequest).authUserId,
    fileName: file.originalname,
    mimeType: file.mimetype,
    draft
  });

  return res.status(200).json({
    data: {
      draft,
      rawTextPreview: rawText.slice(0, 4000),
      uploadId: upload_.id
    }
  });
});

importRouter.get("/resumes", (req: Request, res: Response) => {
  const uploads = store.listResumeUploadsByUser((req as AuthenticatedRequest).authUserId);
  return res.status(200).json({ data: uploads });
});

importRouter.delete("/resumes/:uploadId", (req: Request, res: Response) => {
  const deleted = store.deleteResumeUpload(String(req.params.uploadId), (req as AuthenticatedRequest).authUserId);
  if (!deleted) {
    return res.status(404).json({ error: "Resume upload not found." });
  }
  return res.status(200).json({ data: { deleted: true } });
});

importRouter.post("/github", async (req: Request, res: Response) => {
  if (!env.FEATURE_GITHUB_IMPORT) {
    return res.status(403).json({ error: "GitHub import is currently disabled." });
  }
  const parsed = importGithubSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid GitHub URL.", details: parsed.error.flatten() });
  }

  const analysis = await analyzeGithubProfile(parsed.data.githubUrl);
  if (!analysis) {
    return res.status(422).json({ error: "Could not analyze this GitHub profile. Check the URL and that it is public." });
  }

  return res.status(200).json({
    data: {
      analysis,
      draft: {
        technicalSkills: analysis.languages,
        projects: analysis.topRepos.map((repo) => (repo.description ? `${repo.name} — ${repo.description}` : repo.name)),
        achievements: analysis.totalStars > 0 ? [`${analysis.totalStars} GitHub stars across public repositories`] : []
      }
    }
  });
});

importRouter.post("/portfolio", async (req: Request, res: Response) => {
  if (!env.FEATURE_PORTFOLIO_IMPORT) {
    return res.status(403).json({ error: "Portfolio import is currently disabled." });
  }
  const parsed = importPortfolioSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid portfolio URL.", details: parsed.error.flatten() });
  }

  const analysis = await analyzePortfolio(parsed.data.portfolioUrl);
  if (!analysis) {
    return res.status(422).json({ error: "Could not reach or parse this portfolio URL." });
  }

  return res.status(200).json({ data: { analysis } });
});
