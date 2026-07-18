import { GoogleGenAI } from "@google/genai";
import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import type { AnalysisResult, Profile, SimulationResult, SimulationScenario } from "../../types/domain.js";
import {
  contentAnalysisSchema,
  extractedProfileSchema,
  scenarioSuggestionSchema,
  simulationOutputSchema,
  twinOutputSchema,
  type ContentAnalysisOutput,
  type ExtractedProfileOutput,
  type ScenarioSuggestionOutput,
  type SimulationOutput,
  type TwinOutput
} from "./ai.schemas.js";

type ContentSource = AnalysisResult["source"];

const PROMPT_INJECTION_BLOCKLIST = ["ignore previous", "system prompt", "developer message", "jailbreak"];

function sanitizeInput(value: string): string {
  const lower = value.toLowerCase();
  if (PROMPT_INJECTION_BLOCKLIST.some((token) => lower.includes(token))) {
    return "Potential prompt injection content removed.";
  }
  return value;
}

function parseModelJson<T>(text: string): T {
  const normalized = text.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  return JSON.parse(normalized) as T;
}

function describeScenario(scenario: SimulationScenario): string {
  if (scenario.customPrompt) {
    return `${sanitizeInput(scenario.name)} | custom scenario: ${sanitizeInput(scenario.customPrompt)}`;
  }
  return `${sanitizeInput(scenario.name)} | assumptions: ${scenario.assumptions.map(sanitizeInput).join("; ")}`;
}

const ALIGNMENT_STOPWORDS = new Set([
  "the", "and", "for", "with", "into", "from", "your", "my", "become", "move", "switch", "pursue", "join",
  "stay", "focus", "current", "role", "years", "more", "other", "country", "another", "path", "career", "team"
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+.#\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !ALIGNMENT_STOPWORDS.has(token));
}

/**
 * Compares a scenario's text against the profile's real skills/roles/goals to
 * produce a 0-1 alignment score, used to make simulation outputs vary with how
 * relevant a scenario actually is instead of returning a fixed percentage.
 */
export function computeSkillAlignment(profile: Profile, scenario: SimulationScenario): number {
  const scenarioText = [scenario.name, scenario.customPrompt ?? "", ...scenario.assumptions].join(" ");
  const scenarioTokens = new Set(tokenize(scenarioText));
  if (scenarioTokens.size === 0) return 0.5;

  const profileCorpus = [
    profile.currentRole,
    ...profile.preferredRoles,
    ...profile.technicalSkills,
    ...profile.softSkills,
    ...profile.goals,
    ...profile.certifications,
    ...profile.projects,
    ...profile.achievements
  ]
    .join(" ")
    .toLowerCase();

  let matches = 0;
  scenarioTokens.forEach((token) => {
    if (profileCorpus.includes(token)) matches += 1;
  });

  const scenarioLower = scenarioText.toLowerCase();
  const roleOverlapBoost = profile.preferredRoles.some((role) => scenarioLower.includes(role.toLowerCase())) ? 0.15 : 0;
  const currentRoleBoost = scenarioLower.includes(profile.currentRole.toLowerCase()) ? 0.1 : 0;

  const base = matches / scenarioTokens.size;
  return Math.max(0, Math.min(1, base + roleOverlapBoost + currentRoleBoost));
}

function alignmentTier(alignment: number): "high" | "moderate" | "low" {
  if (alignment >= 0.55) return "high";
  if (alignment >= 0.3) return "moderate";
  return "low";
}

function alignmentToProbability(alignment: number, profile: Profile, index: number): number {
  const experienceBoost = Math.min(10, profile.yearsExperience * 0.6);
  const riskAdjustment = profile.riskTolerance === "high" ? 4 : profile.riskTolerance === "low" ? -4 : 0;
  const primacyAdjustment = index === 0 ? 3 : 0;
  const value = 22 + alignment * 62 + experienceBoost + riskAdjustment + primacyAdjustment;
  return Math.round(Math.max(12, Math.min(94, value)));
}

function buildFallbackScenario(
  profile: Profile,
  scenario: SimulationScenario,
  index: number
): SimulationOutput["scenarios"][number] {
  const alignment = computeSkillAlignment(profile, scenario);
  const tier = alignmentTier(alignment);
  const successProbability = alignmentToProbability(alignment, profile, index);

  return {
    name: scenario.name,
    metrics: {
      salaryGrowth:
        tier === "high"
          ? "High — strong alignment with your current skills and market demand"
          : tier === "moderate"
            ? "Moderate over 12 months"
            : "Low to moderate — limited overlap with your current experience",
      skillGrowth:
        tier === "high"
          ? "Moderate — mostly refining existing strengths"
          : "High — this path requires meaningful new skill acquisition",
      burnoutRisk:
        tier === "high" ? "Low to medium" : tier === "moderate" ? "Medium" : "Medium to high due to the steeper learning curve",
      promotionProbability:
        tier === "high" ? "Medium to high" : tier === "moderate" ? "Medium" : "Low to medium until skill gaps close"
    },
    successProbability,
    salaryProjection:
      tier === "high"
        ? "+15-30% over 12-18 months with successful execution."
        : tier === "moderate"
          ? "+5-15% aligned with standard progression."
          : "Likely flat to modest initially; upside grows only after core skill gaps close.",
    timelineToGoal:
      tier === "high"
        ? "6-12 months with consistent weekly execution."
        : tier === "moderate"
          ? "12-24 months on current trajectory."
          : "18-30+ months given the current skill and experience gap.",
    skillGapAnalysis:
      tier === "high"
        ? [
            "Deepen hands-on portfolio evidence for the target domain.",
            "Strengthen system design / architecture-level communication."
          ]
        : [
            `"${scenario.name}" shares limited overlap with your listed skills (${profile.technicalSkills.slice(0, 3).join(", ") || "few listed skills"}) — plan a structured upskilling track before committing.`,
            "Build one credible proof-of-work project directly in this target domain."
          ],
    risks:
      tier === "low"
        ? [
            "Low current skill overlap increases execution risk without a deliberate upskilling plan.",
            "Requires sustained weekly time investment."
          ]
        : ["Market conditions may shift demand for this path.", "Requires sustained weekly time investment."],
    opportunities: [
      "Rising demand for hybrid technical + strategic skill sets.",
      "Internal mobility or referral paths may accelerate timeline."
    ],
    requiredCertifications: tier !== "high" ? ["Relevant domain certification to close the skill gap and boost credibility."] : [],
    learningRoadmap: [
      "Weeks 1-4: close the highest-priority skill gap with a focused project.",
      "Weeks 5-8: publish evidence (case study, repo, or demo).",
      "Weeks 9-12: apply learnings in real interviews or internal conversations."
    ]
  };
}

interface SimulationEvidenceContext {
  analysisCount: number;
  interviewAnswerCount: number;
}

function buildFallback(
  profile: Profile,
  scenarios: SimulationScenario[],
  context: SimulationEvidenceContext
): SimulationOutput {
  const scenarioResults = scenarios.map((scenario, index) => buildFallbackScenario(profile, scenario, index));
  const bestScenario = scenarioResults.reduce(
    (best, current) => (current.successProbability > best.successProbability ? current : best),
    scenarioResults[0]
  );
  const avgProbability = Math.round(
    scenarioResults.reduce((sum, result) => sum + result.successProbability, 0) / scenarioResults.length
  );

  const evidenceRefs: SimulationOutput["evidenceRefs"] = [
    { type: "user_input", detail: `Goals, constraints, and preferences captured from ${profile.fullName}'s onboarding form.` },
    {
      type: "imported_profile",
      detail: `${profile.technicalSkills.length} technical skills and ${profile.projects.length} projects compared against each scenario's real requirements.`
    }
  ];
  if (context.analysisCount > 0) {
    evidenceRefs.push({
      type: "market_signal",
      detail: `${context.analysisCount} resume/GitHub/portfolio/LinkedIn analyses factored into scenario confidence.`
    });
  }
  if (context.interviewAnswerCount > 0) {
    evidenceRefs.push({
      type: "user_input",
      detail: `${context.interviewAnswerCount} AI interview answers used to refine motivation and risk signals.`
    });
  }
  evidenceRefs.push({
    type: "inferred",
    detail: "Success probabilities are derived from skill/keyword overlap between your profile and each scenario, not a fixed constant."
  });

  return simulationOutputSchema.parse({
    recommendation: `Prioritize the "${bestScenario.name}" path — it shows the strongest alignment (~${bestScenario.successProbability}% modeled success) with your current skills and goals as a staged experiment with measurable checkpoints.`,
    assumptions: [
      "You can invest at least 6 focused hours weekly.",
      "You are willing to run a 30-day low-risk validation experiment."
    ],
    tradeoffs: [
      "Faster growth may increase short-term workload.",
      "Stability-focused choices may slow long-term upside."
    ],
    timeline: [
      "0-30 days: establish target role narrative and evidence plan.",
      "31-90 days: execute one measurable growth project and update profile signals.",
      "3-12 months: iterate applications/interviews with data-informed refinement."
    ],
    actionPlan: [
      "Upgrade top 3 impact bullets with quantified outcomes.",
      "Publish one high-signal project artifact (demo, case study, repo) in 30 days.",
      "Run weekly reflection on progress vs target role requirements."
    ],
    marketDemand: "Demand is rising for candidates with practical AI + product execution depth.",
    lifestyleImpact: "Moderate intensity with manageable strain if weekly cadence is protected.",
    confidenceNarrative: `Confidence is calibrated from ${scenarios.length} scenario(s) with an average modeled success of ${avgProbability}%; overlap with your existing skills is the primary driver, so adding more evidence (analyses, interview answers) will sharpen this further.`,
    confidenceBand: {
      min: Math.max(0.15, Math.min(0.85, avgProbability / 100 - 0.12)),
      max: Math.max(0.25, Math.min(0.95, avgProbability / 100 + 0.1))
    },
    scenarios: scenarioResults,
    evidenceRefs
  });
}

export async function runSimulationWithAi(
  profile: Profile,
  scenarios: SimulationScenario[],
  context: SimulationEvidenceContext = { analysisCount: 0, interviewAnswerCount: 0 }
): Promise<SimulationOutput> {
  if (!env.GEMINI_API_KEY || env.AI_PROVIDER_PRIMARY !== "gemini") {
    return buildFallback(profile, scenarios, context);
  }

  try {
    const client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    const alignmentHints = scenarios
      .map((scenario) => `- "${sanitizeInput(scenario.name)}": estimated skill/role overlap with this profile is ${Math.round(computeSkillAlignment(profile, scenario) * 100)}%.`)
      .join("\n");

    const prompt = `
You are CareerTwin AI. Return strict JSON only.
Never use deterministic future claims.
Always provide assumptions, tradeoffs, confidenceBand, evidenceRefs, and rich per-scenario detail.

CRITICAL: successProbability for each scenario MUST be derived by comparing the profile's real skills,
years of experience, and career relevance against that scenario's actual requirements — not a fixed number.
If a scenario is unrelated to the user's current skills/domain (low overlap), assign a LOW probability (roughly 15-45%)
and reflect that in salaryProjection, timelineToGoal, and skillGapAnalysis (call out the specific missing skills).
If a scenario closely matches the user's existing skills and target roles (high overlap), assign a HIGHER probability
(roughly 65-90%). Use the alignment hints below as a strong signal, then refine using market knowledge.

Alignment hints (heuristic skill/role overlap, use as a strong prior):
${alignmentHints}

Profile:
- Name: ${sanitizeInput(profile.fullName)}
- Current role: ${sanitizeInput(profile.currentRole)}
- Years experience: ${profile.yearsExperience}
- Goals: ${profile.goals.map(sanitizeInput).join(", ")}
- Preferred roles: ${profile.preferredRoles.map(sanitizeInput).join(", ")}
- Technical skills: ${profile.technicalSkills.map(sanitizeInput).join(", ")}
- Career motivation: ${sanitizeInput(profile.careerMotivation)}
- Risk tolerance: ${sanitizeInput(profile.riskTolerance)}
- Location preference: ${sanitizeInput(profile.locationPreference)}
- Evidence available: ${context.analysisCount} analyses, ${context.interviewAnswerCount} interview answers.

Scenarios (may include free-form natural language custom scenarios):
${scenarios.map(describeScenario).join("\n")}

Required JSON shape:
{
  "recommendation": "string",
  "assumptions": ["string"],
  "tradeoffs": ["string"],
  "timeline": ["string"],
  "actionPlan": ["string"],
  "marketDemand": "string",
  "lifestyleImpact": "string",
  "confidenceNarrative": "string",
  "confidenceBand": {"min": 0.0, "max": 1.0},
  "scenarios": [{
    "name": "string",
    "metrics": {"salaryGrowth":"string","skillGrowth":"string","burnoutRisk":"string","promotionProbability":"string"},
    "successProbability": 0-100 (integer percentage, e.g. 72 means 72% — NEVER a 0-1 fraction),
    "salaryProjection": "string",
    "timelineToGoal": "string",
    "skillGapAnalysis": ["string"],
    "risks": ["string"],
    "opportunities": ["string"],
    "requiredCertifications": ["string"],
    "learningRoadmap": ["string"]
  }],
  "evidenceRefs":[{"type":"user_input|imported_profile|market_signal|inferred","detail":"string"}]
}`.trim();

    const response = await client.models.generateContent({
      model: env.GEMINI_MODEL_REASONING,
      contents: prompt
    });

    const parsed = parseModelJson<unknown>(response.text?.trim() ?? "");
    return simulationOutputSchema.parse(parsed);
  } catch (error) {
    logger.warn({ error }, "Gemini request failed, using fallback simulation output");
    return buildFallback(profile, scenarios, context);
  }
}

function buildHeuristicScenarioSuggestions(profile: Profile): ScenarioSuggestionOutput {
  const primaryTarget = profile.preferredRoles[0] ?? "a senior individual contributor role";
  const secondaryGoal = profile.goals[0] ?? `growing within ${profile.currentCompany ?? "your current company"}`;
  const topSkills = profile.technicalSkills.slice(0, 3).join(", ") || "your core stack";

  return scenarioSuggestionSchema.parse({
    scenarios: [
      {
        name: `Advance to ${primaryTarget}`,
        customPrompt: `Pursue ${primaryTarget} by leveraging my current skills in ${topSkills}, targeting a transition within the next 12-18 months.`
      },
      {
        name: `Stay in ${profile.currentRole} and grow`,
        customPrompt: `Stay in my current role as ${profile.currentRole}${profile.currentCompany ? ` at ${profile.currentCompany}` : ""} and pursue ${secondaryGoal} through internal growth and deeper ownership.`
      }
    ]
  });
}

export async function suggestScenariosWithAi(profile: Profile): Promise<ScenarioSuggestionOutput> {
  if (!env.GEMINI_API_KEY || env.AI_PROVIDER_PRIMARY !== "gemini") {
    return buildHeuristicScenarioSuggestions(profile);
  }

  try {
    const client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    const prompt = `
You are CareerTwin AI. Suggest 2 realistic career simulation scenarios personalized to this profile.
One scenario should be an ambitious but plausible move toward the person's stated goals/preferred roles.
The other should be a lower-risk path that builds on their current role.
Return strict JSON only, matching:
{ "scenarios": [{"name":"string (short, 2-6 words)","customPrompt":"string (1-2 sentences, first person, specific)"}] }

Profile:
- Current role: ${sanitizeInput(profile.currentRole)}${profile.currentCompany ? ` at ${sanitizeInput(profile.currentCompany)}` : ""}
- Years experience: ${profile.yearsExperience}
- Goals: ${profile.goals.map(sanitizeInput).join(", ") || "Not specified"}
- Preferred roles: ${profile.preferredRoles.map(sanitizeInput).join(", ") || "Not specified"}
- Technical skills: ${profile.technicalSkills.map(sanitizeInput).join(", ") || "Not specified"}
- Risk tolerance: ${sanitizeInput(profile.riskTolerance)}`.trim();

    const response = await client.models.generateContent({
      model: env.GEMINI_MODEL_FAST,
      contents: prompt
    });

    const parsed = parseModelJson<unknown>(response.text?.trim() ?? "");
    return scenarioSuggestionSchema.parse(parsed);
  } catch (error) {
    logger.warn({ error }, "Gemini scenario suggestion failed, using heuristic fallback");
    return buildHeuristicScenarioSuggestions(profile);
  }
}

export function computeDataCompleteness(profile: Profile, analyses: AnalysisResult[]): number {
  const signals: boolean[] = [
    profile.technicalSkills.length > 0,
    profile.softSkills.length > 0,
    profile.projects.length > 0,
    profile.certifications.length > 0,
    profile.education.length > 0,
    profile.achievements.length > 0,
    Boolean(profile.portfolioUrl),
    Boolean(profile.githubUrl),
    Boolean(profile.linkedinUrl),
    Boolean(profile.resumeText) || profile.workExperience.length > 0,
    profile.interviewInsights.filter(Boolean).length >= 3,
    analyses.length > 0,
    analyses.length >= 2
  ];
  const filled = signals.filter(Boolean).length;
  return Math.round((filled / signals.length) * 100);
}

function deriveCareerArchetype(profile: Profile): string {
  const goalsText = profile.goals.join(" ").toLowerCase();
  if (profile.yearsExperience >= 8) return "Seasoned Technical Leader";
  if (/lead|manage|architect|director/.test(goalsText) || /lead|manage|architect|director/.test(profile.currentRole.toLowerCase())) {
    return "Emerging Technical Leader";
  }
  if (profile.riskTolerance === "high") return "Ambitious Career Explorer";
  if (profile.projects.length >= 3 || profile.achievements.length >= 3) return "Builder & Doer";
  return "Focused Individual Contributor";
}

function buildHeuristicTwin(
  profile: Profile,
  analyses: AnalysisResult[],
  latestSimulation: SimulationResult | null
): TwinOutput {
  const resumeAnalysis = analyses.find((analysis) => analysis.source === "resume");
  const aggregatedGaps = [...new Set(analyses.flatMap((analysis) => analysis.gaps))];
  const aggregatedStrengths = [...new Set(analyses.flatMap((analysis) => analysis.strengths))];

  const strengths = [
    ...(resumeAnalysis?.highlights.strong.slice(0, 2) ?? []),
    ...profile.technicalSkills.slice(0, 3),
    ...profile.softSkills.slice(0, 1),
    ...aggregatedStrengths.slice(0, 1)
  ].filter(Boolean);
  const uniqueStrengths = [...new Set(strengths)].slice(0, 5);

  const growthAreas = aggregatedGaps.length
    ? [...new Set(aggregatedGaps)].slice(0, 3)
    : [
        !profile.certifications.length ? "Certification depth for target roles" : "Strategic prioritization",
        !profile.portfolioUrl && !profile.githubUrl ? "Public portfolio/GitHub evidence" : "Market positioning",
        profile.interviewInsights.filter(Boolean).length < 3 ? "Interview readiness and narrative clarity" : "Leadership narrative"
      ];

  const completeness = computeDataCompleteness(profile, analyses);
  const min = Math.max(0.3, Math.min(0.85, 0.35 + completeness / 250 + (latestSimulation ? latestSimulation.confidenceBand.min * 0.2 : 0)));
  const max = Math.max(min + 0.08, Math.min(0.97, 0.55 + completeness / 200 + (latestSimulation ? latestSimulation.confidenceBand.max * 0.2 : 0)));

  const recommendedNextSteps = resumeAnalysis?.improvementPlan
    .filter((item) => item.priority === "high")
    .slice(0, 2)
    .map((item) => item.action) ?? [];
  if (recommendedNextSteps.length < 2) {
    recommendedNextSteps.push(
      analyses.length < 2
        ? "Add at least one more analysis source (resume, GitHub, or portfolio) to sharpen your Twin's confidence."
        : "Run a career simulation to compare your top target roles side by side."
    );
  }
  if (recommendedNextSteps.length < 2) {
    recommendedNextSteps.push("Complete the AI interview to give your Twin deeper motivation and risk context.");
  }

  return twinOutputSchema.parse({
    summary: `${profile.fullName} is a ${profile.currentRole}${profile.currentCompany ? ` at ${profile.currentCompany}` : ""} with ${profile.yearsExperience} years of experience, targeting ${profile.preferredRoles.join(", ") || "new opportunities"} and motivated by ${profile.careerMotivation}.`,
    strengths: uniqueStrengths.length ? uniqueStrengths : ["Add technical skills and analyses to surface concrete strengths."],
    growthAreas,
    careerArchetype: deriveCareerArchetype(profile),
    marketPositioning: `Positioned as a ${profile.yearsExperience}-year ${profile.currentRole} with depth in ${profile.technicalSkills.slice(0, 3).join(", ") || "their core stack"}; strongest fit today is ${profile.preferredRoles[0] ?? "roles adjacent to their current experience"}.`,
    recommendedNextSteps: recommendedNextSteps.slice(0, 3),
    confidenceBand: { min, max }
  });
}

export async function buildTwinWithAi(
  profile: Profile,
  analyses: AnalysisResult[],
  latestSimulation: SimulationResult | null
): Promise<TwinOutput> {
  if (!env.GEMINI_API_KEY || env.AI_PROVIDER_PRIMARY !== "gemini") {
    return buildHeuristicTwin(profile, analyses, latestSimulation);
  }

  try {
    const client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    const analysesSummary = analyses.length
      ? analyses
          .map((analysis) => `- ${analysis.source} (score ${analysis.score}/100): strengths=${analysis.strengths.slice(0, 2).join("; ")} | gaps=${analysis.gaps.slice(0, 2).join("; ")}`)
          .join("\n")
      : "No analyses submitted yet.";
    const simulationSummary = latestSimulation
      ? `Latest simulation recommendation: ${sanitizeInput(latestSimulation.recommendation)} (confidence ${latestSimulation.confidenceBand.min.toFixed(2)}-${latestSimulation.confidenceBand.max.toFixed(2)}).`
      : "No simulation run yet.";

    const prompt = `
You are CareerTwin AI, building a personalized "digital career twin" for this user. Return strict JSON only.
Base every claim strictly on the data given — do not invent skills or achievements not present.
confidenceBand should be LOWER when few analyses/interview answers exist, and HIGHER as more real evidence is present.

Profile:
- Name: ${sanitizeInput(profile.fullName)}
- Current role: ${sanitizeInput(profile.currentRole)}${profile.currentCompany ? ` at ${sanitizeInput(profile.currentCompany)}` : ""}
- Years experience: ${profile.yearsExperience}
- Goals: ${profile.goals.map(sanitizeInput).join(", ") || "Not specified"}
- Preferred roles: ${profile.preferredRoles.map(sanitizeInput).join(", ") || "Not specified"}
- Technical skills: ${profile.technicalSkills.map(sanitizeInput).join(", ") || "Not specified"}
- Soft skills: ${profile.softSkills.map(sanitizeInput).join(", ") || "Not specified"}
- Career motivation: ${sanitizeInput(profile.careerMotivation)}
- Risk tolerance: ${sanitizeInput(profile.riskTolerance)}
- Interview answers recorded: ${profile.interviewInsights.filter(Boolean).length}

Analyses on file:
${analysesSummary}

${simulationSummary}

Required JSON shape:
{
  "summary": "string (2-3 sentences, first-person-about-them, specific)",
  "strengths": ["string"],
  "growthAreas": ["string"],
  "careerArchetype": "string (2-4 word label)",
  "marketPositioning": "string (1-2 sentences)",
  "recommendedNextSteps": ["string"],
  "confidenceBand": {"min": 0.0, "max": 1.0}
}`.trim();

    const response = await client.models.generateContent({
      model: env.GEMINI_MODEL_REASONING,
      contents: prompt
    });

    const parsed = parseModelJson<unknown>(response.text?.trim() ?? "");
    return twinOutputSchema.parse(parsed);
  } catch (error) {
    logger.warn({ error }, "Gemini twin generation failed, using heuristic fallback");
    return buildHeuristicTwin(profile, analyses, latestSimulation);
  }
}

const EMAIL_REGEX = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const PHONE_REGEX = /(\+?\d[\d\s().-]{7,}\d)/;

function buildHeuristicExtraction(rawText: string): ExtractedProfileOutput {
  const emailMatch = rawText.match(EMAIL_REGEX);
  const phoneMatch = rawText.match(PHONE_REGEX);
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const nameGuess = lines.find((line) => line.length > 2 && line.length < 60 && /^[A-Z][a-zA-Z.\s'-]+$/.test(line));

  const missingFields: string[] = [];
  if (!emailMatch) missingFields.push("email");
  if (!phoneMatch) missingFields.push("phone");
  if (!nameGuess) missingFields.push("fullName");

  return extractedProfileSchema.parse({
    fullName: nameGuess,
    email: emailMatch?.[0],
    phone: phoneMatch?.[0],
    previousCompanies: [],
    workExperience: [],
    technicalSkills: [],
    softSkills: [],
    education: [],
    certifications: [],
    projects: [],
    achievements: [],
    socialLinks: [],
    missingFields,
    sourceSummary:
      "Heuristic extraction used (AI extraction unavailable). Only email/phone/name could be detected reliably — please review and complete the remaining fields manually."
  });
}

export async function extractProfileFromText(rawText: string): Promise<ExtractedProfileOutput> {
  const trimmed = rawText.slice(0, 12000);
  if (!env.GEMINI_API_KEY || env.AI_PROVIDER_PRIMARY !== "gemini") {
    return buildHeuristicExtraction(trimmed);
  }

  try {
    const client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    const prompt = `
You are a resume/profile parsing engine. Extract structured fields from the raw text below.
Return strict JSON only, matching this shape exactly:
{
  "fullName": "string or omit",
  "email": "string or omit",
  "phone": "string or omit",
  "location": "string or omit",
  "currentCompany": "string or omit",
  "currentRole": "string or omit",
  "previousCompanies": ["string"],
  "yearsExperience": 0,
  "workExperience": [{"company":"string","role":"string","duration":"string","description":"string"}],
  "technicalSkills": ["string"],
  "softSkills": ["string"],
  "education": ["string"],
  "certifications": ["string"],
  "projects": ["string"],
  "achievements": ["string"],
  "socialLinks": ["string"],
  "missingFields": ["string - list field names you could not confidently extract"],
  "sourceSummary": "one sentence describing what kind of document this was and extraction confidence"
}
If a field cannot be found, omit it (for optional strings) or return an empty array. Never invent information not present in the text.

Raw text:
"""
${sanitizeInput(trimmed)}
"""`.trim();

    const response = await client.models.generateContent({
      model: env.GEMINI_MODEL_FAST,
      contents: prompt
    });

    const parsed = parseModelJson<unknown>(response.text?.trim() ?? "");
    return extractedProfileSchema.parse(parsed);
  } catch (error) {
    logger.warn({ error }, "Gemini extraction failed, using heuristic fallback");
    return buildHeuristicExtraction(trimmed);
  }
}

const METRIC_REGEX = /(\d+(\.\d+)?\s?(%|percent|x\b|k\b|m\b|million|billion|users|customers)|\$\s?\d)/gi;
const LEADERSHIP_WORDS = ["led", "managed", "mentored", "architected", "founded", "owned", "drove", "spearheaded"];
const ACTION_VERBS = ["built", "designed", "launched", "shipped", "scaled", "optimized", "migrated", "automated", "implemented", "developed"];
const SECTION_KEYWORDS = ["experience", "education", "project", "skill", "summary", "certificat", "achievement", "responsib"];

const CONTENT_SOURCE_LABELS: Record<ContentSource, string> = {
  resume: "resume",
  linkedin: "LinkedIn profile content (About/Experience section)",
  github: "GitHub profile summary or README content",
  portfolio: "portfolio site content"
};

const CONTENT_DIMENSION_LABELS: Record<ContentSource, [string, string, string]> = {
  resume: ["ATS Keyword Match", "Impact Quality", "Formatting Clarity"],
  github: ["Code Consistency", "Engineering Depth", "Docs/Test Quality"],
  portfolio: ["Storytelling", "Visual Quality", "Technical Proof"],
  linkedin: ["Recruiter Visibility", "Brand Positioning", "Credibility Signals"]
};

function extractTopKeywords(content: string, limit: number): string[] {
  const freq = new Map<string, number>();
  tokenize(content).forEach((token) => freq.set(token, (freq.get(token) ?? 0) + 1));
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([word]) => word);
}

/**
 * Derives an analysis directly from the actual pasted/uploaded content (depth, structure,
 * metrics density, leadership/action language, recurring keywords) instead of returning fixed
 * boilerplate — used as the fallback when Gemini is unavailable or rate-limited. Score is
 * intentionally weighted toward substance and length over binary keyword presence, so a short
 * snippet that happens to contain one buzzword can't outscore a longer, well-structured document.
 */
function buildHeuristicContentAnalysis(source: ContentSource, content: string): ContentAnalysisOutput {
  const normalized = content.toLowerCase();
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  const sentenceCount = content.split(/[.!?]/).filter((item) => item.trim().length > 5).length;
  const metricMatches = content.match(METRIC_REGEX) ?? [];
  const hasMetrics = metricMatches.length > 0;
  const leadershipHits = LEADERSHIP_WORDS.filter((word) => normalized.includes(word));
  const actionHits = ACTION_VERBS.filter((word) => normalized.includes(word));
  const sectionHits = SECTION_KEYWORDS.filter((word) => normalized.includes(word));
  const topKeywords = extractTopKeywords(content, 4);
  const distinctKeywordCount = new Set(tokenize(content)).size;

  const depthScore = Math.min(24, Math.round(wordCount / 12));
  const metricScore = Math.min(16, metricMatches.length * 8);
  const leadershipScore = Math.min(12, leadershipHits.length * 6);
  const actionScore = Math.min(16, actionHits.length * 4);
  const diversityScore = Math.min(12, Math.round(distinctKeywordCount * 0.8));
  const structureScore = Math.min(12, sectionHits.length * 3);
  const score = Math.max(
    28,
    Math.min(96, 8 + depthScore + metricScore + leadershipScore + actionScore + diversityScore + structureScore)
  );

  const strengths = [
    wordCount >= 80
      ? `Substantive content (${wordCount} words) gives enough depth to evaluate real experience, not just headline claims.`
      : topKeywords.length
        ? `Recurring themes around ${topKeywords.slice(0, 3).join(", ")} come through clearly in this content.`
        : `This ${source} content is specific enough to analyze rather than purely aspirational language.`,
    hasMetrics
      ? `Includes ${metricMatches.length} quantified outcome${metricMatches.length > 1 ? "s" : ""} (numbers/percentages) that make impact easy to verify.`
      : actionHits.length
        ? `Uses concrete action verbs (${actionHits.slice(0, 3).join(", ")}) that signal hands-on ownership.`
        : "Provides a readable baseline narrative to sharpen further.",
    sectionHits.length >= 3
      ? `Covers multiple substantive sections (${sectionHits.slice(0, 3).join(", ")}), which reads as complete rather than a fragment.`
      : leadershipHits.length
        ? `Leadership/ownership language detected (${leadershipHits.slice(0, 2).join(", ")}).`
        : "Structure is clear enough to layer in stronger positioning."
  ];

  const gaps = [
    wordCount < 60
      ? `This content is quite short (${wordCount} words) — a sparse document reads as incomplete to recruiters even if the few details present are strong.`
      : !hasMetrics
        ? "No quantified outcomes detected (%, $, or specific numbers) in this text — add measurable impact to your top achievements."
        : "Quantified outcomes are present but could extend to more of your bullets/sections.",
    !leadershipHits.length
      ? "No leadership/ownership language detected (e.g., led, owned, drove) — consider framing scope of impact."
      : "Leadership language is present but the scope of ownership could be more explicit.",
    sectionHits.length < 2
      ? "Few recognizable sections (experience, education, skills, projects) detected — organizing content under clear headers helps both recruiters and ATS parsers."
      : sentenceCount < 6
        ? "This content is relatively short — add more specific detail to strengthen the narrative for recruiters."
        : "Consider tightening the narrative so the strongest points stand out immediately."
  ];

  const recommendations = [
    wordCount < 60
      ? "Expand this content with specific role, project, and outcome details — a short summary alone won't stand out to recruiters or AI screening."
      : "Add one measurable business impact statement (%, $, or count) to your top achievement in this content.",
    topKeywords.length
      ? `Make sure "${topKeywords[0]}" and related keywords are positioned near the top for recruiter/ATS scanning.`
      : "Prioritize role-targeted keywords near the top for recruiter and ATS discoverability.",
    "Strengthen your evidence ledger with public artifacts (case studies, PRs, demos) that back up these claims."
  ];

  return contentAnalysisSchema.parse({
    score,
    dimensionScores: CONTENT_DIMENSION_LABELS[source].map((key, index) => ({
      key,
      score: Math.max(30, Math.min(96, score + (index === 0 ? 2 : index === 1 ? -4 : -7))),
      explanation:
        index === 0
          ? "Derived from keyword density and structure specific to this content."
          : index === 1
            ? "Derived from concrete detail, action verbs, and ownership language found in this content."
            : "Derived from quantified outcomes and documentation-style clarity in this content."
    })),
    strengths,
    gaps,
    recommendations,
    recruiterPerspective: `Recruiters scanning this ${source} would notice ${topKeywords.length ? topKeywords.slice(0, 2).join(" and ") : "the overall narrative"}; ${hasMetrics ? "the quantified outcomes help credibility" : "adding quantified outcomes would raise credibility"}.`,
    hiringManagerPerspective: `Hiring managers would weigh ${leadershipHits.length ? "the ownership language present" : "the lack of explicit ownership language"} alongside ${actionHits.length ? "the concrete action verbs used" : "the level of specificity"} when assessing seniority fit.`
  });
}

export async function analyzeContentWithAi(source: ContentSource, content: string, profile: Profile): Promise<ContentAnalysisOutput> {
  const trimmed = content.slice(0, 8000);
  if (!env.GEMINI_API_KEY || env.AI_PROVIDER_PRIMARY !== "gemini") {
    return buildHeuristicContentAnalysis(source, trimmed);
  }

  try {
    const client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    const prompt = `
You are CareerTwin AI, a career analyst. Analyze ONLY the ${CONTENT_SOURCE_LABELS[source]} text provided below —
this is real content pasted or uploaded by the candidate, and it is DIFFERENT every time you are called. Your
analysis MUST be grounded in specifics you can point to in THIS text (reference actual skills, companies,
projects, metrics, or phrases found in it). NEVER return generic boilerplate that could apply to any candidate —
if two different inputs would receive the same strengths/gaps, you have failed this task.

Candidate context (for framing tone only — do not invent facts not present in the text below):
- Target roles: ${profile.preferredRoles.map(sanitizeInput).join(", ") || "Not specified"}
- Current role: ${sanitizeInput(profile.currentRole)}

Return strict JSON only, matching this shape:
{
  "score": 0,
  "dimensionScores": [{"key":"string","score":0,"explanation":"string referencing this specific content"}],
  "strengths": ["string referencing specific details from this content"],
  "gaps": ["string referencing what is missing or weak in this content"],
  "recommendations": ["string, specific and actionable for this content"],
  "recruiterPerspective": "string",
  "hiringManagerPerspective": "string"
}
Provide 2-4 dimensionScores with labels appropriate for a ${source}. Provide 3 strengths, 3 gaps, 3 recommendations.

${CONTENT_SOURCE_LABELS[source]}:
"""
${sanitizeInput(trimmed)}
"""`.trim();

    const response = await client.models.generateContent({
      model: env.GEMINI_MODEL_FAST,
      contents: prompt
    });

    const parsed = parseModelJson<unknown>(response.text?.trim() ?? "");
    return contentAnalysisSchema.parse(parsed);
  } catch (error) {
    logger.warn({ error }, "Gemini content analysis failed, using heuristic fallback");
    return buildHeuristicContentAnalysis(source, trimmed);
  }
}
