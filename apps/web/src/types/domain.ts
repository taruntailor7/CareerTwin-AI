export interface WorkExperienceEntry {
  company: string;
  role: string;
  duration: string;
  description?: string;
}

export interface Profile {
  id: string;
  clerkUserId: string;
  // User-facing name distinguishing this profile from others owned by the same account
  // (e.g. "Software Engineer track" vs "Product Management pivot").
  label: string;
  fullName: string;
  email: string;
  phone?: string;
  currentRole: string;
  currentCompany?: string;
  previousCompanies: string[];
  workExperience: WorkExperienceEntry[];
  yearsExperience: number;
  goals: string[];
  preferredRoles: string[];
  dreamCompanies: string[];
  preferredCountries: string[];
  locationPreference: string;
  expectedSalary?: number;
  currentSalary?: number;
  noticePeriodWeeks?: number;
  education: string[];
  technicalSkills: string[];
  softSkills: string[];
  languages: string[];
  certifications: string[];
  achievements: string[];
  projects: string[];
  portfolioUrl?: string;
  githubUrl?: string;
  linkedinUrl?: string;
  resumeText?: string;
  careerMotivation: string;
  workStyle: string;
  riskTolerance: "low" | "medium" | "high";
  interviewInsights: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ExtractedProfileDraft {
  fullName?: string;
  email?: string;
  phone?: string;
  location?: string;
  currentCompany?: string;
  currentRole?: string;
  previousCompanies: string[];
  yearsExperience?: number;
  workExperience: WorkExperienceEntry[];
  technicalSkills: string[];
  softSkills: string[];
  education: string[];
  certifications: string[];
  projects: string[];
  achievements: string[];
  socialLinks: string[];
  missingFields: string[];
  sourceSummary: string;
}

export interface Twin {
  id: string;
  profileId: string;
  summary: string;
  strengths: string[];
  growthAreas: string[];
  confidence: { min: number; max: number };
  careerArchetype: string;
  marketPositioning: string;
  recommendedNextSteps: string[];
  dataCompleteness: number;
  createdAt: string;
}

export interface ResumeUpload {
  id: string;
  clerkUserId: string;
  fileName: string;
  mimeType: string;
  draft: ExtractedProfileDraft;
  createdAt: string;
}

export interface SimulationScenarioResult {
  name: string;
  metrics: {
    salaryGrowth: string;
    skillGrowth: string;
    burnoutRisk: string;
    promotionProbability: string;
  };
  successProbability: number;
  salaryProjection: string;
  timelineToGoal: string;
  skillGapAnalysis: string[];
  risks: string[];
  opportunities: string[];
  requiredCertifications: string[];
  learningRoadmap: string[];
}

export interface SimulationResult {
  id: string;
  profileId: string;
  recommendation: string;
  assumptions: string[];
  tradeoffs: string[];
  timeline: string[];
  actionPlan: string[];
  marketDemand: string;
  lifestyleImpact: string;
  confidenceNarrative: string;
  confidenceBand: { min: number; max: number };
  scenarios: SimulationScenarioResult[];
  evidenceRefs: Array<{
    type: "user_input" | "imported_profile" | "market_signal" | "inferred";
    detail: string;
  }>;
}

export interface Report {
  id: string;
  profileId: string;
  simulationId: string;
  title: string;
  audience: "mentor" | "self" | "stakeholder";
  summary: string;
  status: "ready";
  createdAt: string;
}

export interface AnalysisResult {
  id: string;
  profileId: string;
  source: "resume" | "github" | "portfolio" | "linkedin";
  score: number;
  dimensionScores: Array<{
    key: string;
    score: number;
    explanation: string;
  }>;
  strengths: string[];
  gaps: string[];
  recommendations: string[];
  recruiterPerspective: string;
  hiringManagerPerspective: string;
  highlights: {
    strong: string[];
    missing: string[];
    weak: string[];
  };
  improvementPlan: Array<{
    action: string;
    priority: "high" | "medium" | "low";
    expectedImpact: string;
  }>;
  createdAt: string;
}

export interface CareerScorecard {
  profileId: string;
  generatedAt: string;
  overallScore: number;
  categories: Array<{
    key: string;
    score: number;
    explanation: string;
    pointsLostReason: string;
    improvementSteps: string[];
    expectedScoreAfterImprovement: number;
  }>;
}

export interface ScenarioComparison {
  profileId: string;
  generatedAt: string;
  scenarios: Array<{
    name: string;
    scores: {
      salaryGrowth: number;
      skillGrowth: number;
      burnoutRisk: number;
      promotionProbability: number;
      overall: number;
    };
  }>;
}

export interface InterviewSession {
  id: string;
  profileId: string;
  answered: Array<{
    question: string;
    answer: string;
  }>;
  nextQuestion: string | null;
  isComplete: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GithubAnalysis {
  username: string;
  profile: { name: string | null; bio: string | null; company: string | null; followers: number; accountAgeYears: number };
  repoCount: number;
  originalRepoCount: number;
  totalStars: number;
  languages: string[];
  recentlyActiveRepoCount: number;
  readmeCoveredSample: number;
  topRepos: Array<{ name: string; description: string | null; stars: number; language: string | null }>;
  score: number;
}

export interface PortfolioAnalysis {
  url: string;
  isHttps: boolean;
  responseTimeMs: number;
  title: string | null;
  metaDescription: string | null;
  hasViewportMeta: boolean;
  hasOpenGraph: boolean;
  wordCount: number;
  imageCount: number;
  imagesWithAlt: number;
  hasContactSignal: boolean;
  projectSectionCount: number;
  score: number;
}
