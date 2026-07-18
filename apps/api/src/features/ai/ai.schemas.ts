import { z } from "zod";

export const confidenceBandSchema = z.object({
  min: z.number().min(0).max(1),
  max: z.number().min(0).max(1)
});

const scenarioResultSchema = z.object({
  name: z.string(),
  metrics: z.object({
    salaryGrowth: z.string(),
    skillGrowth: z.string(),
    burnoutRisk: z.string(),
    promotionProbability: z.string()
  }),
  // Models occasionally return a 0-1 fraction despite prompt instructions to use a 0-100 scale;
  // normalize here since this is untrusted external AI output, not a UI-facing display concern.
  successProbability: z
    .number()
    .min(0)
    .max(100)
    .transform((value) => (value > 0 && value <= 1 ? Math.round(value * 100) : Math.round(value))),
  salaryProjection: z.string().min(3),
  timelineToGoal: z.string().min(3),
  skillGapAnalysis: z.array(z.string()).min(1),
  risks: z.array(z.string()).min(1),
  opportunities: z.array(z.string()).min(1),
  requiredCertifications: z.array(z.string()).default([]),
  learningRoadmap: z.array(z.string()).min(1)
});

export const simulationOutputSchema = z.object({
  recommendation: z.string().min(10),
  assumptions: z.array(z.string()).min(2),
  tradeoffs: z.array(z.string()).min(2),
  timeline: z.array(z.string()).min(3),
  actionPlan: z.array(z.string()).min(3),
  marketDemand: z.string().min(5),
  lifestyleImpact: z.string().min(5),
  confidenceNarrative: z.string().min(10),
  confidenceBand: confidenceBandSchema,
  scenarios: z.array(scenarioResultSchema).min(2),
  evidenceRefs: z
    .array(
      z.object({
        type: z.enum(["user_input", "imported_profile", "market_signal", "inferred"]),
        detail: z.string()
      })
    )
    .min(2)
});

export type SimulationOutput = z.infer<typeof simulationOutputSchema>;

const workExperienceDraftSchema = z.object({
  company: z.string(),
  role: z.string(),
  duration: z.string(),
  description: z.string().optional()
});

export const extractedProfileSchema = z.object({
  fullName: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  currentCompany: z.string().optional(),
  currentRole: z.string().optional(),
  previousCompanies: z.array(z.string()).default([]),
  yearsExperience: z.number().int().min(0).max(60).optional(),
  workExperience: z.array(workExperienceDraftSchema).default([]),
  technicalSkills: z.array(z.string()).default([]),
  softSkills: z.array(z.string()).default([]),
  education: z.array(z.string()).default([]),
  certifications: z.array(z.string()).default([]),
  projects: z.array(z.string()).default([]),
  achievements: z.array(z.string()).default([]),
  socialLinks: z.array(z.string()).default([]),
  missingFields: z.array(z.string()).default([]),
  sourceSummary: z.string().min(5)
});

export type ExtractedProfileOutput = z.infer<typeof extractedProfileSchema>;

export const twinOutputSchema = z.object({
  summary: z.string().min(20),
  strengths: z.array(z.string()).min(1),
  growthAreas: z.array(z.string()).min(1),
  careerArchetype: z.string().min(3),
  marketPositioning: z.string().min(10),
  recommendedNextSteps: z.array(z.string()).min(2),
  confidenceBand: confidenceBandSchema
});

export type TwinOutput = z.infer<typeof twinOutputSchema>;

export const scenarioSuggestionSchema = z.object({
  scenarios: z
    .array(
      z.object({
        name: z.string().min(2),
        customPrompt: z.string().min(10)
      })
    )
    .min(2)
    .max(3)
});

export type ScenarioSuggestionOutput = z.infer<typeof scenarioSuggestionSchema>;

export const contentAnalysisSchema = z.object({
  score: z.number().min(0).max(100),
  dimensionScores: z
    .array(z.object({ key: z.string().min(2), score: z.number().min(0).max(100), explanation: z.string().min(5) }))
    .min(2)
    .max(4),
  strengths: z.array(z.string().min(5)).min(2).max(5),
  gaps: z.array(z.string().min(5)).min(2).max(5),
  recommendations: z.array(z.string().min(5)).min(2).max(5),
  recruiterPerspective: z.string().min(10),
  hiringManagerPerspective: z.string().min(10)
});

export type ContentAnalysisOutput = z.infer<typeof contentAnalysisSchema>;
