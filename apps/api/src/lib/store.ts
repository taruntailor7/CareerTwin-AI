import { randomUUID } from "node:crypto";
import { persistence } from "./persistence.js";
import type {
  AnalysisResult,
  ExtractedProfileDraft,
  InterviewSession,
  Profile,
  Report,
  ResumeUpload,
  ScenarioComparison,
  SimulationResult,
  Twin
} from "../types/domain.js";

const now = () => new Date().toISOString();

const profiles = new Map<string, Profile>();
const twins = new Map<string, Twin>();
const simulations = new Map<string, SimulationResult>();
const reports = new Map<string, Report>();
const analyses = new Map<string, AnalysisResult>();
const interviews = new Map<string, InterviewSession>();
const resumeUploads = new Map<string, ResumeUpload>();

export const store = {
  createProfile(input: Omit<Profile, "id" | "createdAt" | "updatedAt">): Profile {
    const profile: Profile = {
      ...input,
      id: randomUUID(),
      createdAt: now(),
      updatedAt: now()
    };
    profiles.set(profile.id, profile);
    void persistence.persistProfile(profile);
    return profile;
  },
  // Returns null if the profile doesn't exist or isn't owned by clerkUserId, so routes can
  // distinguish "not found" from "forbidden" without a separate ownership lookup.
  updateProfile(
    profileId: string,
    clerkUserId: string,
    input: Omit<Profile, "id" | "clerkUserId" | "createdAt" | "updatedAt">
  ): Profile | null {
    const existing = profiles.get(profileId);
    if (!existing || existing.clerkUserId !== clerkUserId) {
      return null;
    }
    const profile: Profile = {
      ...input,
      id: existing.id,
      clerkUserId: existing.clerkUserId,
      createdAt: existing.createdAt,
      updatedAt: now()
    };
    profiles.set(profile.id, profile);
    void persistence.persistProfile(profile);
    return profile;
  },
  listProfilesByUser(clerkUserId: string): Profile[] {
    return [...profiles.values()]
      .filter((profile) => profile.clerkUserId === clerkUserId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  getProfile(profileId: string): Profile | null {
    return profiles.get(profileId) ?? null;
  },
  saveTwin(input: Omit<Twin, "id" | "createdAt">): Twin {
    const twin: Twin = { ...input, id: randomUUID(), createdAt: now() };
    twins.set(twin.id, twin);
    void persistence.persistTwin(twin);
    return twin;
  },
  latestTwinForProfile(profileId: string): Twin | null {
    return [...twins.values()].filter((item) => item.profileId === profileId).at(-1) ?? null;
  },
  saveSimulation(input: Omit<SimulationResult, "id" | "createdAt">): SimulationResult {
    const simulation: SimulationResult = { ...input, id: randomUUID(), createdAt: now() };
    simulations.set(simulation.id, simulation);
    void persistence.persistSimulation(simulation);
    return simulation;
  },
  getSimulation(simulationId: string): SimulationResult | null {
    return simulations.get(simulationId) ?? null;
  },
  listSimulations(profileId: string): SimulationResult[] {
    return [...simulations.values()].filter((simulation) => simulation.profileId === profileId);
  },
  saveReport(input: Omit<Report, "id" | "createdAt" | "status">): Report {
    const report: Report = { ...input, id: randomUUID(), status: "ready", createdAt: now() };
    reports.set(report.id, report);
    void persistence.persistReport(report);
    return report;
  },
  listReports(profileId: string): Report[] {
    return [...reports.values()].filter((report) => report.profileId === profileId);
  },
  getReport(reportId: string): Report | null {
    return reports.get(reportId) ?? null;
  },
  saveAnalysis(input: Omit<AnalysisResult, "id" | "createdAt">): AnalysisResult {
    const analysis: AnalysisResult = { ...input, id: randomUUID(), createdAt: now() };
    analyses.set(analysis.id, analysis);
    void persistence.persistAnalysis(analysis);
    return analysis;
  },
  listAnalyses(profileId: string): AnalysisResult[] {
    return [...analyses.values()].filter((analysis) => analysis.profileId === profileId);
  },
  saveInterviewSession(input: Omit<InterviewSession, "id" | "createdAt" | "updatedAt">): InterviewSession {
    const existing = [...interviews.values()].find((session) => session.profileId === input.profileId);
    const session: InterviewSession = {
      id: existing?.id ?? randomUUID(),
      profileId: input.profileId,
      answered: input.answered,
      nextQuestion: input.nextQuestion,
      isComplete: input.isComplete,
      createdAt: existing?.createdAt ?? now(),
      updatedAt: now()
    };
    interviews.set(session.id, session);
    void persistence.persistInterview(session);
    return session;
  },
  getInterviewSession(profileId: string): InterviewSession | null {
    return [...interviews.values()].find((session) => session.profileId === profileId) ?? null;
  },
  saveResumeUpload(input: { clerkUserId: string; fileName: string; mimeType: string; draft: ExtractedProfileDraft }): ResumeUpload {
    const upload: ResumeUpload = { ...input, id: randomUUID(), createdAt: now() };
    resumeUploads.set(upload.id, upload);
    return upload;
  },
  listResumeUploadsByUser(clerkUserId: string): ResumeUpload[] {
    return [...resumeUploads.values()].filter((upload) => upload.clerkUserId === clerkUserId);
  },
  deleteResumeUpload(uploadId: string, clerkUserId: string): boolean {
    const upload = resumeUploads.get(uploadId);
    if (!upload || upload.clerkUserId !== clerkUserId) {
      return false;
    }
    resumeUploads.delete(uploadId);
    return true;
  },
  buildScenarioComparison(profileId: string): ScenarioComparison | null {
    const latestSimulation = this.listSimulations(profileId).at(-1);
    if (!latestSimulation) {
      return null;
    }

    const toScore = (value: string) => {
      const text = value.toLowerCase();
      if (text.includes("high")) return 82;
      if (text.includes("moderate")) return 64;
      if (text.includes("medium")) return 60;
      if (text.includes("low")) return 38;
      return 55;
    };

    return {
      profileId,
      generatedAt: now(),
      scenarios: latestSimulation.scenarios.map((scenario) => {
        const salaryGrowth = toScore(scenario.metrics.salaryGrowth);
        const skillGrowth = toScore(scenario.metrics.skillGrowth);
        const burnoutRisk = 100 - toScore(scenario.metrics.burnoutRisk);
        const promotionProbability = toScore(scenario.metrics.promotionProbability);
        const overall = Math.round(
          (salaryGrowth + skillGrowth + burnoutRisk + promotionProbability + scenario.successProbability) / 5
        );

        return {
          name: scenario.name,
          scores: {
            salaryGrowth,
            skillGrowth,
            burnoutRisk,
            promotionProbability,
            overall
          }
        };
      })
    };
  },
  loadProfile(profile: Profile) {
    profiles.set(profile.id, profile);
  },
  loadTwin(twin: Twin) {
    twins.set(twin.id, twin);
  },
  loadSimulation(simulation: SimulationResult) {
    simulations.set(simulation.id, simulation);
  },
  loadReport(report: Report) {
    reports.set(report.id, report);
  },
  loadAnalysis(analysis: AnalysisResult) {
    analyses.set(analysis.id, analysis);
  },
  loadInterview(session: InterviewSession) {
    interviews.set(session.id, session);
  }
};
