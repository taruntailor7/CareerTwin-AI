import { Router, type Request, type Response } from "express";
import { analyzeContentWithAi } from "../ai/ai.service.js";
import { env } from "../../config/env.js";
import { store } from "../../lib/store.js";
import { type AuthenticatedRequest } from "../../middleware/auth.js";
import { analyzeGithubProfile } from "../../services/github.service.js";
import { analyzePortfolio } from "../../services/portfolio.service.js";
import { buildCareerScorecard } from "../../services/scorecard.service.js";
import type { AnalysisResult, Profile } from "../../types/domain.js";
import { ingestAnalysisSchema } from "./analysis.schemas.js";

export const analysisRouter = Router();

interface HeuristicAnalysis {
  score: number;
  dimensionScores: Array<{ key: string; score: number; explanation: string }>;
  strengths: string[];
  gaps: string[];
  recommendations: string[];
  recruiterPerspective: string;
  hiringManagerPerspective: string;
}

function buildImprovementPlan(
  gaps: string[],
  recommendations: string[]
): AnalysisResult["improvementPlan"] {
  return recommendations.slice(0, 4).map((action, index) => ({
    action,
    priority: index === 0 ? "high" : index === 1 ? "medium" : "low",
    expectedImpact:
      index === 0
        ? `Directly addresses: ${gaps[0] ?? "top identified gap"}.`
        : "Compounds with earlier actions to raise recruiter/ATS visibility."
  }));
}

function buildHighlights(score: number, strengths: string[], gaps: string[]): AnalysisResult["highlights"] {
  return {
    strong: strengths,
    missing: gaps.slice(0, 2),
    weak: score < 60 ? gaps : gaps.slice(2)
  };
}

async function buildLiveGithubAnalysis(profile: Profile, overrideUrl?: string): Promise<HeuristicAnalysis | null> {
  const githubUrl = overrideUrl ?? profile.githubUrl;
  if (!githubUrl) return null;
  const analysis = await analyzeGithubProfile(githubUrl);
  if (!analysis) return null;

  const strengths = [
    `${analysis.originalRepoCount} original public repositories across ${analysis.languages.length} languages.`,
    analysis.recentlyActiveRepoCount > 0
      ? `${analysis.recentlyActiveRepoCount} repositories updated in the last 6 months — activity is fresh.`
      : "Profile has established repository history.",
    analysis.totalStars > 0 ? `${analysis.totalStars} cumulative stars signal community validation.` : "Consistent repository naming and structure."
  ];
  const gaps = [
    analysis.readmeCoveredSample < 2 ? "Top repositories are missing clear README documentation." : "README depth could go further with usage examples.",
    analysis.languages.length < 3 ? "Limited language diversity may narrow perceived versatility." : "Consider consolidating scattered smaller repos into fewer flagship projects.",
    analysis.recentlyActiveRepoCount === 0 ? "No recent commit activity detected in the last 6 months." : "Contribution graph consistency could be smoother."
  ];
  const recommendations = [
    "Add a detailed README (problem, approach, tech stack, screenshots) to your top 3 repositories.",
    "Pin your strongest projects and add topics/tags for discoverability.",
    "Commit consistently on at least one active project to keep your contribution graph fresh."
  ];

  return {
    score: analysis.score,
    dimensionScores: [
      { key: "Repository Quality", score: analysis.score, explanation: "Composite of originality, activity, and documentation." },
      { key: "Language Diversity", score: Math.min(95, 50 + analysis.languages.length * 6), explanation: "Breadth of technologies demonstrated." },
      { key: "Documentation", score: Math.min(95, 40 + analysis.readmeCoveredSample * 15), explanation: "README coverage across top repositories." }
    ],
    strengths,
    gaps,
    recommendations,
    recruiterPerspective: `GitHub presence shows ${analysis.originalRepoCount} original projects with ${analysis.totalStars} stars — a credible technical signal for recruiters scanning for hands-on proof.`,
    hiringManagerPerspective:
      "Repository activity and documentation quality are strong predictors of real-world engineering discipline; current profile suggests solid execution ability."
  };
}

async function buildLivePortfolioAnalysis(profile: Profile, overrideUrl?: string): Promise<HeuristicAnalysis | null> {
  const portfolioUrl = overrideUrl ?? profile.portfolioUrl;
  if (!portfolioUrl) return null;
  const analysis = await analyzePortfolio(portfolioUrl);
  if (!analysis) return null;

  const strengths = [
    analysis.hasViewportMeta ? "Site is configured for responsive/mobile viewing." : "Site loaded successfully and is publicly reachable.",
    analysis.metaDescription ? "Meta description present for SEO and link previews." : `Fast response time (${analysis.responseTimeMs}ms).`,
    analysis.hasContactSignal ? "Clear contact pathway is available for recruiters." : "Content volume suggests substantive project write-ups."
  ];
  const gaps = [
    !analysis.hasViewportMeta ? "Missing responsive viewport meta tag — may render poorly on mobile." : "Could deepen case-study style write-ups per project.",
    !analysis.hasOpenGraph ? "No Open Graph tags — link previews on LinkedIn/Twitter will look generic." : "Image alt-text coverage could be more complete for accessibility.",
    !analysis.hasContactSignal ? "No obvious contact/email call-to-action detected." : "Consider adding more visual project screenshots."
  ];
  const recommendations = [
    !analysis.hasViewportMeta ? "Add a responsive viewport meta tag and test on mobile breakpoints." : "Add measurable outcomes (metrics, users, performance gains) to each project.",
    !analysis.hasOpenGraph ? "Add Open Graph + meta description tags for better link previews and SEO." : "Add alt text to all project screenshots for accessibility and SEO.",
    "Add a clear, visible contact section or CTA button above the fold."
  ];

  return {
    score: analysis.score,
    dimensionScores: [
      { key: "Technical Foundations", score: Math.round((analysis.hasViewportMeta ? 1 : 0) * 20 + (analysis.hasOpenGraph ? 1 : 0) * 15 + 50), explanation: "Responsive design, SEO tags, and performance." },
      { key: "Content Depth", score: Math.min(95, 40 + Math.min(40, Math.round(analysis.wordCount / 30))), explanation: "Volume and substance of project write-ups." },
      { key: "Accessibility", score: analysis.imageCount > 0 ? Math.round((analysis.imagesWithAlt / analysis.imageCount) * 100) : 70, explanation: "Alt-text coverage across images." }
    ],
    strengths,
    gaps,
    recommendations,
    recruiterPerspective: `Portfolio ${analysis.hasContactSignal ? "makes it easy" : "makes it somewhat harder"} for recruiters to reach out, and loads in ${analysis.responseTimeMs}ms.`,
    hiringManagerPerspective:
      "A well-structured, fast-loading portfolio with clear project narratives strongly correlates with strong communication and product sense."
  };
}

analysisRouter.post("/ingest", async (req: Request, res: Response) => {
  const parsed = ingestAnalysisSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid analysis payload.", details: parsed.error.flatten() });
  }

  const profile = store.getProfile(parsed.data.profileId);
  if (!profile || profile.clerkUserId !== (req as AuthenticatedRequest).authUserId) {
    return res.status(403).json({ error: "Forbidden profile access." });
  }

  let heuristic: HeuristicAnalysis | null = null;

  if (parsed.data.useLiveSource && parsed.data.source === "github") {
    if (!env.FEATURE_GITHUB_IMPORT) {
      return res.status(403).json({ error: "Live GitHub analysis is currently disabled." });
    }
    heuristic = await buildLiveGithubAnalysis(profile, parsed.data.sourceUrl);
    if (!heuristic) {
      return res.status(422).json({ error: "No GitHub URL provided, or the GitHub profile could not be analyzed." });
    }
  } else if (parsed.data.useLiveSource && parsed.data.source === "portfolio") {
    if (!env.FEATURE_PORTFOLIO_IMPORT) {
      return res.status(403).json({ error: "Live portfolio analysis is currently disabled." });
    }
    heuristic = await buildLivePortfolioAnalysis(profile, parsed.data.sourceUrl);
    if (!heuristic) {
      return res.status(422).json({ error: "No portfolio URL provided, or the portfolio could not be reached." });
    }
  } else {
    if (!parsed.data.content) {
      return res.status(400).json({ error: "Content is required when not using a live source." });
    }
    heuristic = await analyzeContentWithAi(parsed.data.source, parsed.data.content, profile);
  }

  const analysis = store.saveAnalysis({
    profileId: profile.id,
    source: parsed.data.source,
    score: heuristic.score,
    dimensionScores: heuristic.dimensionScores,
    strengths: heuristic.strengths,
    gaps: heuristic.gaps,
    recommendations: heuristic.recommendations,
    recruiterPerspective: heuristic.recruiterPerspective,
    hiringManagerPerspective: heuristic.hiringManagerPerspective,
    highlights: buildHighlights(heuristic.score, heuristic.strengths, heuristic.gaps),
    improvementPlan: buildImprovementPlan(heuristic.gaps, heuristic.recommendations)
  });

  return res.status(201).json({ data: analysis });
});

analysisRouter.get("/profile/:profileId", (req: Request, res: Response) => {
  const profile = store.getProfile(String(req.params.profileId));
  if (!profile || profile.clerkUserId !== (req as AuthenticatedRequest).authUserId) {
    return res.status(403).json({ error: "Forbidden profile access." });
  }

  return res.status(200).json({ data: store.listAnalyses(profile.id) });
});

analysisRouter.get("/scorecard/:profileId", (req: Request, res: Response) => {
  const profile = store.getProfile(String(req.params.profileId));
  if (!profile || profile.clerkUserId !== (req as AuthenticatedRequest).authUserId) {
    return res.status(403).json({ error: "Forbidden profile access." });
  }

  const scorecard = buildCareerScorecard(profile, store.listAnalyses(profile.id));
  return res.status(200).json({ data: scorecard });
});
