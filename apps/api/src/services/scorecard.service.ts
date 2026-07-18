import type { AnalysisResult, CareerScorecard, Profile } from "../types/domain.js";

type Source = AnalysisResult["source"];

export function buildCareerScorecard(profile: Profile, analyses: AnalysisResult[]): CareerScorecard {
  const latestBySource = new Map<Source, AnalysisResult>();
  analyses.forEach((analysis) => latestBySource.set(analysis.source, analysis));

  const scoreOrDefault = (source: Source, fallback: number) => latestBySource.get(source)?.score ?? fallback;

  const technicalSkillsScore = Math.min(96, 40 + profile.technicalSkills.length * 5 + profile.certifications.length * 3);
  const projectQualityScore = Math.min(96, 38 + profile.projects.length * 8);
  const professionalBrandingScore = Math.round(
    (scoreOrDefault("linkedin", 55) + scoreOrDefault("portfolio", 55) + (profile.achievements.length > 0 ? 10 : 0) + 40) / 2
  );
  const recruiterReadinessScore = Math.round(
    (scoreOrDefault("resume", 55) + technicalSkillsScore + professionalBrandingScore) / 3
  );

  const categories: Array<{ key: string; score: number; explanationBase: string }> = [
    { key: "Resume", score: scoreOrDefault("resume", 50), explanationBase: "Based on latest resume analysis." },
    {
      key: "ATS Compatibility",
      score: latestBySource.get("resume")?.dimensionScores.find((d) => d.key.includes("ATS"))?.score ?? scoreOrDefault("resume", 50),
      explanationBase: "Keyword and formatting compatibility with applicant tracking systems."
    },
    { key: "LinkedIn", score: scoreOrDefault("linkedin", 50), explanationBase: "Based on latest LinkedIn content analysis." },
    { key: "GitHub", score: scoreOrDefault("github", 50), explanationBase: "Based on latest GitHub profile analysis." },
    { key: "Portfolio", score: scoreOrDefault("portfolio", 50), explanationBase: "Based on latest portfolio analysis." },
    { key: "Technical Skills", score: technicalSkillsScore, explanationBase: "Breadth of listed technical skills and certifications." },
    { key: "Project Quality", score: projectQualityScore, explanationBase: "Depth and count of showcased projects." },
    { key: "Professional Branding", score: professionalBrandingScore, explanationBase: "Consistency of positioning across LinkedIn and portfolio." },
    { key: "Recruiter Readiness", score: recruiterReadinessScore, explanationBase: "Composite of resume, skills, and branding signals." }
  ];

  const scorecardCategories = categories.map((category) => ({
    key: category.key,
    score: category.score,
    explanation: category.explanationBase,
    pointsLostReason:
      category.score >= 80
        ? "Minor refinements only — no major gaps detected."
        : "Missing quantified evidence, incomplete signals, or low content depth in this area.",
    improvementSteps: [
      `Add one concrete, measurable proof point relevant to ${category.key}.`,
      `Re-run analysis after updating ${category.key.toLowerCase()} content to track improvement.`
    ],
    expectedScoreAfterImprovement: Math.min(98, category.score + 12)
  }));

  const overallScore = Math.round(scorecardCategories.reduce((sum, cat) => sum + cat.score, 0) / scorecardCategories.length);

  return {
    profileId: profile.id,
    generatedAt: new Date().toISOString(),
    overallScore,
    categories: scorecardCategories
  };
}
