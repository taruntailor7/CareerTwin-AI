import { logger } from "./logger.js";
import { getPrismaClient } from "./prisma.js";
import type { AnalysisResult, InterviewSession, Profile, Report, SimulationResult, Twin } from "../types/domain.js";

function toJson(value: unknown): string {
  return JSON.stringify(value);
}

function fromJson<T>(value: unknown, fallback: T): T {
  if (typeof value === "object" && value !== null) {
    return value as T;
  }
  if (typeof value !== "string") {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export const persistence = {
  async persistProfile(profile: Profile) {
    const prisma = getPrismaClient() as any;
    if (!prisma) return;
    await prisma.profile.upsert({
      where: { id: profile.id },
      create: {
        id: profile.id,
        clerkUserId: profile.clerkUserId,
        label: profile.label,
        fullName: profile.fullName,
        email: profile.email,
        phone: profile.phone,
        currentRole: profile.currentRole,
        currentCompany: profile.currentCompany,
        previousCompanies: profile.previousCompanies,
        workExperience: profile.workExperience,
        yearsExperience: profile.yearsExperience,
        goals: profile.goals,
        preferredRoles: profile.preferredRoles,
        dreamCompanies: profile.dreamCompanies,
        preferredCountries: profile.preferredCountries,
        locationPreference: profile.locationPreference,
        expectedSalary: profile.expectedSalary,
        currentSalary: profile.currentSalary,
        noticePeriodWeeks: profile.noticePeriodWeeks,
        education: profile.education,
        technicalSkills: profile.technicalSkills,
        softSkills: profile.softSkills,
        languages: profile.languages,
        certifications: profile.certifications,
        achievements: profile.achievements,
        projects: profile.projects,
        portfolioUrl: profile.portfolioUrl,
        githubUrl: profile.githubUrl,
        linkedinUrl: profile.linkedinUrl,
        resumeText: profile.resumeText,
        careerMotivation: profile.careerMotivation,
        workStyle: profile.workStyle,
        riskTolerance: profile.riskTolerance,
        interviewInsights: profile.interviewInsights
      },
      update: {
        label: profile.label,
        fullName: profile.fullName,
        email: profile.email,
        phone: profile.phone,
        currentRole: profile.currentRole,
        currentCompany: profile.currentCompany,
        previousCompanies: profile.previousCompanies,
        workExperience: profile.workExperience,
        yearsExperience: profile.yearsExperience,
        goals: profile.goals,
        preferredRoles: profile.preferredRoles,
        dreamCompanies: profile.dreamCompanies,
        preferredCountries: profile.preferredCountries,
        locationPreference: profile.locationPreference,
        expectedSalary: profile.expectedSalary,
        currentSalary: profile.currentSalary,
        noticePeriodWeeks: profile.noticePeriodWeeks,
        education: profile.education,
        technicalSkills: profile.technicalSkills,
        softSkills: profile.softSkills,
        languages: profile.languages,
        certifications: profile.certifications,
        achievements: profile.achievements,
        projects: profile.projects,
        portfolioUrl: profile.portfolioUrl,
        githubUrl: profile.githubUrl,
        linkedinUrl: profile.linkedinUrl,
        resumeText: profile.resumeText,
        careerMotivation: profile.careerMotivation,
        workStyle: profile.workStyle,
        riskTolerance: profile.riskTolerance,
        interviewInsights: profile.interviewInsights
      }
    });
  },
  async persistTwin(twin: Twin) {
    const prisma = getPrismaClient() as any;
    if (!prisma) return;
    await prisma.twin.upsert({
      where: { id: twin.id },
      create: {
        id: twin.id,
        profileId: twin.profileId,
        summary: twin.summary,
        strengths: twin.strengths,
        growthAreas: twin.growthAreas,
        confidenceMin: twin.confidence.min,
        confidenceMax: twin.confidence.max,
        careerArchetype: twin.careerArchetype,
        marketPositioning: twin.marketPositioning,
        recommendedNextSteps: twin.recommendedNextSteps,
        dataCompleteness: twin.dataCompleteness,
        createdAt: new Date(twin.createdAt)
      },
      update: {
        summary: twin.summary,
        strengths: twin.strengths,
        growthAreas: twin.growthAreas,
        confidenceMin: twin.confidence.min,
        confidenceMax: twin.confidence.max,
        careerArchetype: twin.careerArchetype,
        marketPositioning: twin.marketPositioning,
        recommendedNextSteps: twin.recommendedNextSteps,
        dataCompleteness: twin.dataCompleteness
      }
    });
  },
  async persistSimulation(simulation: SimulationResult) {
    const prisma = getPrismaClient() as any;
    if (!prisma) return;
    await prisma.simulation.upsert({
      where: { id: simulation.id },
      create: {
        id: simulation.id,
        profileId: simulation.profileId,
        recommendation: simulation.recommendation,
        assumptions: simulation.assumptions,
        tradeoffs: simulation.tradeoffs,
        confidenceMin: simulation.confidenceBand.min,
        confidenceMax: simulation.confidenceBand.max,
        scenariosJson: simulation.scenarios,
        evidenceJson: simulation.evidenceRefs,
        createdAt: new Date(simulation.createdAt)
      },
      update: {
        recommendation: simulation.recommendation,
        assumptions: simulation.assumptions,
        tradeoffs: simulation.tradeoffs,
        confidenceMin: simulation.confidenceBand.min,
        confidenceMax: simulation.confidenceBand.max,
        scenariosJson: simulation.scenarios,
        evidenceJson: simulation.evidenceRefs
      }
    });
  },
  async persistReport(report: Report) {
    const prisma = getPrismaClient() as any;
    if (!prisma) return;
    await prisma.report.upsert({
      where: { id: report.id },
      create: {
        id: report.id,
        profileId: report.profileId,
        simulationId: report.simulationId,
        title: report.title,
        audience: report.audience,
        summary: report.summary,
        status: report.status,
        createdAt: new Date(report.createdAt)
      },
      update: {
        title: report.title,
        audience: report.audience,
        summary: report.summary,
        status: report.status
      }
    });
  },
  async persistAnalysis(analysis: AnalysisResult) {
    const prisma = getPrismaClient() as any;
    if (!prisma) return;
    await prisma.analysis.upsert({
      where: { id: analysis.id },
      create: {
        id: analysis.id,
        profileId: analysis.profileId,
        source: analysis.source,
        score: analysis.score,
        dimensionScoresJson: toJson(analysis.dimensionScores),
        strengths: analysis.strengths,
        gaps: analysis.gaps,
        recommendations: analysis.recommendations,
        recruiterPerspective: analysis.recruiterPerspective,
        hiringManagerPerspective: analysis.hiringManagerPerspective,
        highlightsJson: toJson(analysis.highlights),
        improvementPlanJson: toJson(analysis.improvementPlan),
        createdAt: new Date(analysis.createdAt)
      },
      update: {
        source: analysis.source,
        score: analysis.score,
        dimensionScoresJson: toJson(analysis.dimensionScores),
        strengths: analysis.strengths,
        gaps: analysis.gaps,
        recommendations: analysis.recommendations,
        recruiterPerspective: analysis.recruiterPerspective,
        hiringManagerPerspective: analysis.hiringManagerPerspective,
        highlightsJson: toJson(analysis.highlights),
        improvementPlanJson: toJson(analysis.improvementPlan)
      }
    });
  },
  async persistInterview(session: InterviewSession) {
    const prisma = getPrismaClient() as any;
    if (!prisma) return;
    await prisma.interviewSession.upsert({
      where: { id: session.id },
      create: {
        id: session.id,
        profileId: session.profileId,
        answeredJson: toJson(session.answered),
        nextQuestion: session.nextQuestion,
        isComplete: session.isComplete,
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.updatedAt)
      },
      update: {
        answeredJson: toJson(session.answered),
        nextQuestion: session.nextQuestion,
        isComplete: session.isComplete,
        updatedAt: new Date(session.updatedAt)
      }
    });
  },
  async hydrateToStore(loaders: {
    loadProfile: (profile: Profile) => void;
    loadTwin: (twin: Twin) => void;
    loadSimulation: (simulation: SimulationResult) => void;
    loadReport: (report: Report) => void;
    loadAnalysis: (analysis: AnalysisResult) => void;
    loadInterview: (session: InterviewSession) => void;
  }) {
    const prisma = getPrismaClient() as any;
    if (!prisma) return;
    try {
      const [profiles, twins, simulations, reports, analyses, interviews] = await Promise.all([
        prisma.profile.findMany(),
        prisma.twin.findMany(),
        prisma.simulation.findMany(),
        prisma.report.findMany(),
        prisma.analysis.findMany(),
        prisma.interviewSession.findMany()
      ]);

      (profiles as any[]).forEach((profile) =>
        loaders.loadProfile({
          id: profile.id,
          clerkUserId: profile.clerkUserId,
          label: profile.label ?? profile.currentRole,
          fullName: profile.fullName,
          email: profile.email,
          phone: profile.phone ?? undefined,
          currentRole: profile.currentRole,
          currentCompany: profile.currentCompany ?? undefined,
          previousCompanies: profile.previousCompanies ?? [],
          workExperience: profile.workExperience ?? [],
          yearsExperience: profile.yearsExperience,
          goals: profile.goals,
          preferredRoles: profile.preferredRoles,
          dreamCompanies: profile.dreamCompanies,
          preferredCountries: profile.preferredCountries,
          locationPreference: profile.locationPreference,
          expectedSalary: profile.expectedSalary ?? undefined,
          currentSalary: profile.currentSalary ?? undefined,
          noticePeriodWeeks: profile.noticePeriodWeeks ?? undefined,
          education: profile.education,
          technicalSkills: profile.technicalSkills,
          softSkills: profile.softSkills,
          languages: profile.languages,
          certifications: profile.certifications,
          achievements: profile.achievements,
          projects: profile.projects,
          portfolioUrl: profile.portfolioUrl ?? undefined,
          githubUrl: profile.githubUrl ?? undefined,
          linkedinUrl: profile.linkedinUrl ?? undefined,
          resumeText: profile.resumeText ?? undefined,
          careerMotivation: profile.careerMotivation,
          workStyle: profile.workStyle,
          riskTolerance: profile.riskTolerance as "low" | "medium" | "high",
          interviewInsights: profile.interviewInsights,
          createdAt: profile.createdAt.toISOString(),
          updatedAt: profile.updatedAt.toISOString()
        })
      );

      (twins as any[]).forEach((twin) =>
        loaders.loadTwin({
          id: twin.id,
          profileId: twin.profileId,
          summary: twin.summary,
          strengths: twin.strengths,
          growthAreas: twin.growthAreas,
          confidence: { min: twin.confidenceMin, max: twin.confidenceMax },
          careerArchetype: twin.careerArchetype ?? "Focused Individual Contributor",
          marketPositioning: twin.marketPositioning ?? "Market positioning unavailable for historical migrated item.",
          recommendedNextSteps: twin.recommendedNextSteps ?? [],
          dataCompleteness: twin.dataCompleteness ?? 50,
          createdAt: twin.createdAt.toISOString()
        })
      );

      (simulations as any[]).forEach((simulation) =>
        loaders.loadSimulation({
          id: simulation.id,
          profileId: simulation.profileId,
          recommendation: simulation.recommendation,
          assumptions: simulation.assumptions,
          tradeoffs: simulation.tradeoffs,
          timeline: [],
          actionPlan: [],
          marketDemand: "Market signal not available in persisted snapshot.",
          lifestyleImpact: "Lifestyle signal not available in persisted snapshot.",
          confidenceNarrative: "Confidence narrative unavailable for historical migrated item.",
          confidenceBand: { min: simulation.confidenceMin, max: simulation.confidenceMax },
          scenarios: fromJson(simulation.scenariosJson as unknown as string, []),
          evidenceRefs: fromJson(simulation.evidenceJson as unknown as string, []),
          createdAt: simulation.createdAt.toISOString()
        })
      );

      (reports as any[]).forEach((report) =>
        loaders.loadReport({
          id: report.id,
          profileId: report.profileId,
          simulationId: report.simulationId,
          title: report.title,
          audience: report.audience as "mentor" | "self" | "stakeholder",
          summary: report.summary,
          status: "ready",
          createdAt: report.createdAt.toISOString()
        })
      );

      (analyses as any[]).forEach((analysis) =>
        loaders.loadAnalysis({
          id: analysis.id,
          profileId: analysis.profileId,
          source: analysis.source as "resume" | "github" | "portfolio" | "linkedin",
          score: analysis.score,
          dimensionScores: fromJson(analysis.dimensionScoresJson, []),
          strengths: analysis.strengths,
          gaps: analysis.gaps,
          recommendations: analysis.recommendations,
          recruiterPerspective: analysis.recruiterPerspective,
          hiringManagerPerspective: analysis.hiringManagerPerspective,
          highlights: fromJson(analysis.highlightsJson, { strong: [], missing: [], weak: [] }),
          improvementPlan: fromJson(analysis.improvementPlanJson, []),
          createdAt: analysis.createdAt.toISOString()
        })
      );

      (interviews as any[]).forEach((session) =>
        loaders.loadInterview({
          id: session.id,
          profileId: session.profileId,
          answered: fromJson(session.answeredJson, []),
          nextQuestion: session.nextQuestion,
          isComplete: session.isComplete,
          createdAt: session.createdAt.toISOString(),
          updatedAt: session.updatedAt.toISOString()
        })
      );
    } catch (error) {
      logger.warn({ error }, "Failed hydrating persisted data, continuing with memory store");
    }
  }
};
