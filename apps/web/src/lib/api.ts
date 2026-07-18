import type {
  AnalysisResult,
  CareerScorecard,
  ExtractedProfileDraft,
  GithubAnalysis,
  InterviewSession,
  PortfolioAnalysis,
  Profile,
  Report,
  ResumeUpload,
  ScenarioComparison,
  SimulationResult,
  Twin,
  WorkExperienceEntry
} from "@/types/domain";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

interface RequestOptions extends RequestInit {
  userId: string;
}

// Zod's `.flatten()` shape from the API's validation error responses — surfaced in the thrown
// message so a failed save is self-diagnosable from the toast instead of a dead-end generic error.
function describeValidationDetails(details: unknown): string {
  const fieldErrors = (details as { fieldErrors?: Record<string, string[] | undefined> } | undefined)?.fieldErrors;
  if (!fieldErrors) return "";
  const parts = Object.entries(fieldErrors)
    .filter(([, messages]) => messages?.length)
    .map(([field, messages]) => `${field}: ${messages!.join(", ")}`);
  return parts.length ? ` (${parts.join("; ")})` : "";
}

async function request<T>(path: string, options: RequestOptions): Promise<T> {
  const { userId, ...requestOptions } = options;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...requestOptions,
    headers: {
      "Content-Type": "application/json",
      "x-clerk-user-id": userId,
      ...(requestOptions.headers ?? {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(`${body.error ?? "Request failed"}${describeValidationDetails(body.details)}`);
  }

  const payload = (await response.json()) as { data: T };
  return payload.data;
}

export interface UpsertProfilePayload {
  label?: string;
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
}

export function listProfiles(userId: string): Promise<Profile[]> {
  return request<Profile[]>("/api/v1/profiles", { userId });
}

export function createProfile(payload: UpsertProfilePayload, userId: string): Promise<Profile> {
  return request<Profile>("/api/v1/profiles", {
    userId,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateProfile(profileId: string, payload: UpsertProfilePayload, userId: string): Promise<Profile> {
  return request<Profile>(`/api/v1/profiles/${profileId}`, {
    userId,
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function buildTwin(profileId: string, userId: string): Promise<Twin> {
  return request<Twin>("/api/v1/twin/build", {
    userId,
    method: "POST",
    body: JSON.stringify({ profileId })
  });
}

export interface RunSimulationPayload {
  profileId: string;
  scenarios: Array<{
    id: string;
    name: string;
    assumptions?: string[];
    customPrompt?: string;
  }>;
}

export function runSimulation(payload: RunSimulationPayload, userId: string): Promise<SimulationResult> {
  return request<SimulationResult>("/api/v1/simulations/run", {
    userId,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function getSimulationComparison(profileId: string, userId: string): Promise<ScenarioComparison> {
  return request<ScenarioComparison>(`/api/v1/simulations/compare/${profileId}`, { userId });
}

export function getDashboard(profileId: string, userId: string): Promise<{
  profile: Profile;
  latestTwin: Twin | null;
  latestSimulation: SimulationResult | null;
  analysisCount: number;
  averageAnalysisScore: number | null;
  reportCount: number;
  nextActions: string[];
}> {
  return request<{
    profile: Profile;
    latestTwin: Twin | null;
    latestSimulation: SimulationResult | null;
    analysisCount: number;
    averageAnalysisScore: number | null;
    reportCount: number;
    nextActions: string[];
  }>(`/api/v1/dashboard/${profileId}`, { userId });
}

export function getProfile(profileId: string, userId: string): Promise<Profile> {
  return request<Profile>(`/api/v1/profiles/${profileId}`, { userId });
}

export function getReports(profileId: string, userId: string): Promise<Report[]> {
  return request<Report[]>(`/api/v1/reports/profile/${profileId}`, { userId });
}

export function ingestAnalysis(payload: {
  userId: string;
  profileId: string;
  source: "resume" | "github" | "portfolio" | "linkedin";
  content?: string;
  useLiveSource?: boolean;
  sourceUrl?: string;
}): Promise<AnalysisResult> {
  return request<AnalysisResult>("/api/v1/analysis/ingest", {
    userId: payload.userId,
    method: "POST",
    body: JSON.stringify({
      profileId: payload.profileId,
      source: payload.source,
      content: payload.content,
      useLiveSource: payload.useLiveSource ?? false,
      sourceUrl: payload.sourceUrl || undefined
    })
  });
}

export function getScorecard(profileId: string, userId: string): Promise<CareerScorecard> {
  return request<CareerScorecard>(`/api/v1/analysis/scorecard/${profileId}`, { userId });
}

export async function importResume(
  file: File,
  userId: string
): Promise<{ draft: ExtractedProfileDraft; rawTextPreview: string; uploadId: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${API_BASE_URL}/api/v1/import/resume`, {
    method: "POST",
    headers: { "x-clerk-user-id": userId },
    body: formData,
    cache: "no-store"
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? "Resume import failed.");
  }
  const payload = (await response.json()) as {
    data: { draft: ExtractedProfileDraft; rawTextPreview: string; uploadId: string };
  };
  return payload.data;
}

export function importGithub(
  githubUrl: string,
  userId: string
): Promise<{ analysis: GithubAnalysis; draft: { technicalSkills: string[]; projects: string[]; achievements: string[] } }> {
  return request("/api/v1/import/github", {
    userId,
    method: "POST",
    body: JSON.stringify({ githubUrl })
  });
}

export function importPortfolio(portfolioUrl: string, userId: string): Promise<{ analysis: PortfolioAnalysis }> {
  return request("/api/v1/import/portfolio", {
    userId,
    method: "POST",
    body: JSON.stringify({ portfolioUrl })
  });
}

export function getResumeUploads(userId: string): Promise<ResumeUpload[]> {
  return request<ResumeUpload[]>("/api/v1/import/resumes", { userId });
}

export function deleteResumeUpload(uploadId: string, userId: string): Promise<{ deleted: boolean }> {
  return request<{ deleted: boolean }>(`/api/v1/import/resumes/${uploadId}`, { userId, method: "DELETE" });
}

export function suggestScenarios(profileId: string, userId: string): Promise<{ scenarios: Array<{ name: string; customPrompt: string }> }> {
  return request("/api/v1/simulations/suggest", {
    userId,
    method: "POST",
    body: JSON.stringify({ profileId })
  });
}

export async function downloadReportPdf(reportId: string, userId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/reports/${reportId}/pdf`, {
    headers: { "x-clerk-user-id": userId },
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error("Could not generate PDF report.");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `careertwin-report-${reportId}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function getAnalyses(profileId: string, userId: string): Promise<AnalysisResult[]> {
  return request<AnalysisResult[]>(`/api/v1/analysis/profile/${profileId}`, { userId });
}

export function getInterviewSession(profileId: string, userId: string): Promise<InterviewSession> {
  return request<InterviewSession>(`/api/v1/interview/profile/${profileId}`, { userId });
}

export function answerInterviewQuestion(payload: {
  userId: string;
  profileId: string;
  answer: string;
}): Promise<InterviewSession> {
  return request<InterviewSession>("/api/v1/interview/answer", {
    userId: payload.userId,
    method: "POST",
    body: JSON.stringify({
      profileId: payload.profileId,
      answer: payload.answer
    })
  });
}

export function getReportDetail(reportId: string, userId: string): Promise<{
  report: Report;
  sections: {
    executiveSummary: string;
    strengths: string[];
    risks: string[];
    evidence: Array<{ type: string; detail: string }>;
    scenarioHighlight: {
      name: string;
      successProbability: number;
      salaryProjection: string;
      timelineToGoal: string;
    } | null;
    actionPlan90Days: string[];
  };
}> {
  return request(`/api/v1/reports/${reportId}/detail`, { userId });
}

export function generateReport(payload: {
  userId: string;
  profileId: string;
  simulationId: string;
  title: string;
  audience: "mentor" | "self" | "stakeholder";
}): Promise<Report> {
  return request<Report>("/api/v1/reports/generate", {
    userId: payload.userId,
    method: "POST",
    body: JSON.stringify({
      profileId: payload.profileId,
      simulationId: payload.simulationId,
      title: payload.title,
      audience: payload.audience
    })
  });
}
