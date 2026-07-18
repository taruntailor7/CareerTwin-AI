"use client";

import { useAuth } from "@clerk/nextjs";
import * as Tabs from "@radix-ui/react-tabs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileText, FolderGit2, Gauge, Link2, LayoutDashboard, Sparkles, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { AiConciergeHero } from "@/components/ai-concierge-hero";
import { AuthControls } from "@/components/auth-controls";
import { CareerScorecard } from "@/components/career-scorecard";
import { CareerTwinPanel } from "@/components/career-twin-panel";
import { OnboardingForm, type OnboardingValues } from "@/components/onboarding-form";
import { ProfileSwitcher } from "@/components/profile-switcher";
import { ReportDetailView } from "@/components/report-detail-view";
import { ResumeImport } from "@/components/resume-import";
import { SimulationForm, type SimulationFormValues } from "@/components/simulation-form";
import { EmptyState, ErrorState, LoadingState } from "@/components/state-blocks";
import { ThemeToggle } from "@/components/theme-toggle";
import { Toast, type ToastState } from "@/components/ui/toast";
import { TwinLiveMap } from "@/components/twin-live-map";
import { Button } from "@/components/ui/button";
import {
  answerInterviewQuestion,
  buildTwin,
  createProfile,
  downloadReportPdf,
  generateReport,
  getAnalyses,
  getInterviewSession,
  getReportDetail,
  getScorecard,
  getSimulationComparison,
  getDashboard,
  getReports,
  importResume,
  ingestAnalysis,
  listProfiles,
  runSimulation,
  suggestScenarios,
  updateProfile
} from "@/lib/api";
import type { AnalysisResult, ExtractedProfileDraft, Profile, Report, SimulationResult, Twin, WorkExperienceEntry } from "@/types/domain";

const TABS = [
  { value: "onboarding", label: "Onboarding", icon: Sparkles },
  { value: "simulation", label: "Simulation", icon: LayoutDashboard },
  { value: "analysis", label: "Analysis", icon: FileText },
  { value: "scorecard", label: "Scorecard", icon: Gauge },
  { value: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { value: "reports", label: "Reports", icon: FileText }
];

const CARD = "rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)]";
const SUBCARD = "rounded-xl border border-[var(--border-soft)] bg-[var(--surface-2)] p-3.5";

// Converts a saved profile back into onboarding form values so a refresh (or revisit) restores
// what was already saved instead of showing a blank form beneath an already-generated twin.
function mapProfileToOnboardingDraft(profile: Profile): Partial<OnboardingValues> {
  const [interviewQ1, interviewQ2, interviewQ3, interviewQ4, interviewQ5] = profile.interviewInsights;
  return {
    label: profile.label,
    fullName: profile.fullName,
    email: profile.email,
    phone: profile.phone,
    currentRole: profile.currentRole,
    currentCompany: profile.currentCompany,
    previousCompanies: profile.previousCompanies,
    yearsExperience: profile.yearsExperience,
    locationPreference: profile.locationPreference,
    noticePeriodWeeks: profile.noticePeriodWeeks,
    goals: profile.goals,
    preferredRoles: profile.preferredRoles,
    dreamCompanies: profile.dreamCompanies,
    preferredCountries: profile.preferredCountries,
    expectedSalary: profile.expectedSalary,
    currentSalary: profile.currentSalary,
    careerMotivation: profile.careerMotivation,
    workStyle: profile.workStyle,
    riskTolerance: profile.riskTolerance,
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
    interviewQ1,
    interviewQ2,
    interviewQ3,
    interviewQ4,
    interviewQ5
  };
}

// The API rejects blank strings in these fields — trims/dedupes so stray whitespace-only tags
// (which can slip in via AI-extracted drafts) never turn a save into a 400 the user can't explain.
function sanitizeStringArray(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function sanitizeWorkExperienceEntries(entries: WorkExperienceEntry[]): WorkExperienceEntry[] {
  return entries
    .map((entry) => ({
      company: entry.company?.trim() ?? "",
      role: entry.role?.trim() ?? "",
      duration: entry.duration?.trim() || "Not specified",
      description: entry.description?.trim() || undefined
    }))
    .filter((entry) => entry.company && entry.role);
}

function selectedProfileStorageKey(userId: string): string {
  return `careertwin:selected-profile:${userId}`;
}

function getStoredSelectedProfileId(userId?: string | null): string | null {
  if (typeof window === "undefined" || !userId) return null;
  return window.localStorage.getItem(selectedProfileStorageKey(userId));
}

function setStoredSelectedProfileId(userId: string, profileId: string | null) {
  if (typeof window === "undefined") return;
  if (profileId) window.localStorage.setItem(selectedProfileStorageKey(userId), profileId);
  else window.localStorage.removeItem(selectedProfileStorageKey(userId));
}

export default function Home() {
  const { isSignedIn, userId } = useAuth();
  const queryClient = useQueryClient();
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [isCreatingNewProfile, setIsCreatingNewProfile] = useState(false);
  // Holds the profile saved mid-onboarding (when entering the AI Interview step) before the twin
  // is actually built — kept separate from selectedProfileId so the in-progress wizard never
  // remounts (its key is derived from activeProfile, which only becomes this profile on Build).
  const [pendingProfile, setPendingProfile] = useState<Profile | null>(null);
  const [latestTwin, setLatestTwin] = useState<Twin | null>(null);
  const [latestSimulation, setLatestSimulation] = useState<SimulationResult | null>(null);
  const [analysisSource, setAnalysisSource] = useState<"resume" | "github" | "portfolio" | "linkedin">("resume");
  const [analysisContent, setAnalysisContent] = useState("");
  const [analysisGithubUrl, setAnalysisGithubUrl] = useState("");
  const [analysisPortfolioUrl, setAnalysisPortfolioUrl] = useState("");
  const [interviewAnswer, setInterviewAnswer] = useState("");
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("onboarding");
  const [toast, setToast] = useState<ToastState | null>(null);
  const [draftSeed, setDraftSeed] = useState<{ values: Partial<OnboardingValues>; version: number } | null>(null);
  const [importedWorkExperience, setImportedWorkExperience] = useState<WorkExperienceEntry[]>([]);

  function notify(text: string, tone: "success" | "error") {
    setToast({ id: Date.now(), text, tone });
  }

  function handleDraftReady(draft: Partial<ExtractedProfileDraft>, summary: string) {
    const values: Partial<OnboardingValues> = {};
    if (draft.fullName) values.fullName = draft.fullName;
    if (draft.email) values.email = draft.email;
    if (draft.phone) values.phone = draft.phone;
    if (draft.location) values.locationPreference = draft.location;
    if (draft.currentCompany) values.currentCompany = draft.currentCompany;
    if (draft.currentRole) values.currentRole = draft.currentRole;
    if (draft.yearsExperience !== undefined) values.yearsExperience = draft.yearsExperience;
    if (draft.previousCompanies?.length) values.previousCompanies = draft.previousCompanies;
    if (draft.technicalSkills?.length) values.technicalSkills = draft.technicalSkills;
    if (draft.education?.length) values.education = draft.education;
    if (draft.certifications?.length) values.certifications = draft.certifications;
    if (draft.projects?.length) values.projects = draft.projects;
    if (draft.achievements?.length) values.achievements = draft.achievements;

    if (draft.workExperience?.length) {
      // The draft already reflects the merged history across every uploaded resume
      // (see resume-import.tsx mergeExtractedDrafts), so replace rather than append.
      setImportedWorkExperience(draft.workExperience);
    }

    setDraftSeed((prev) => ({ values, version: (prev?.version ?? 0) + 1 }));
    notify(summary, "success");
  }

  const profilesQuery = useQuery({
    queryKey: ["profiles", userId],
    queryFn: () => listProfiles(userId!),
    enabled: Boolean(userId)
  });

  const profiles = profilesQuery.data ?? [];
  // Falls back to the last profile the user had open (persisted across refreshes) and, failing
  // that, the most recently updated profile — never surfaces a blank switcher state by accident.
  const effectiveSelectedProfileId = selectedProfileId ?? getStoredSelectedProfileId(userId) ?? profiles[0]?.id ?? null;
  const activeProfile = isCreatingNewProfile ? null : profiles.find((item) => item.id === effectiveSelectedProfileId) ?? null;

  // Clears every piece of transient, per-profile UI state that isn't itself keyed by profile id —
  // otherwise leftover values (a typed-but-unsaved GitHub URL, a just-run simulation, an open
  // report) would visually bleed from the previously active profile into the newly selected one.
  function resetPerProfileUiState() {
    setImportedWorkExperience([]);
    setLatestTwin(null);
    setLatestSimulation(null);
    setAnalysisContent("");
    setAnalysisGithubUrl("");
    setAnalysisPortfolioUrl("");
    setInterviewAnswer("");
    setSelectedReportId(null);
    setPendingProfile(null);
    // A resume imported for the previously active profile must not auto-fill the next one —
    // the onboarding form remounts (see `key` below) and would otherwise re-apply it on mount.
    setDraftSeed(null);
  }

  function selectProfile(profileId: string) {
    setIsCreatingNewProfile(false);
    setSelectedProfileId(profileId);
    resetPerProfileUiState();
    if (userId) setStoredSelectedProfileId(userId, profileId);
  }

  function startNewProfile() {
    setIsCreatingNewProfile(true);
    setSelectedProfileId(null);
    resetPerProfileUiState();
    if (userId) setStoredSelectedProfileId(userId, null);
  }

  // Restores a previously saved profile into the onboarding form so a refresh (or revisit)
  // shows what was already saved instead of a blank form beneath an already-generated twin.
  const profileSeed = useMemo(
    () => (activeProfile ? { values: mapProfileToOnboardingDraft(activeProfile), version: Date.parse(activeProfile.updatedAt) } : null),
    [activeProfile]
  );

  const dashboardQuery = useQuery({
    queryKey: ["dashboard", activeProfile?.id, userId],
    queryFn: () => getDashboard(activeProfile!.id, userId!),
    enabled: Boolean(userId && activeProfile?.id)
  });

  const reportsQuery = useQuery({
    queryKey: ["reports", activeProfile?.id, userId],
    queryFn: () => getReports(activeProfile!.id, userId!),
    enabled: Boolean(activeProfile?.id)
  });

  const analysesQuery = useQuery({
    queryKey: ["analyses", activeProfile?.id, userId],
    queryFn: () => getAnalyses(activeProfile!.id, userId!),
    enabled: Boolean(activeProfile?.id && userId)
  });

  const scorecardQuery = useQuery({
    queryKey: ["scorecard", activeProfile?.id, userId, analysesQuery.data?.length],
    queryFn: () => getScorecard(activeProfile!.id, userId!),
    enabled: Boolean(activeProfile?.id && userId)
  });

  // Prefer state from a just-completed action; fall back to the last persisted snapshot
  // from the dashboard so these survive a page refresh (same pattern as `activeProfile` above).
  const displayedTwin = latestTwin ?? dashboardQuery.data?.latestTwin ?? null;
  const displayedSimulation = latestSimulation ?? dashboardQuery.data?.latestSimulation ?? null;
  const displayedWorkExperience = importedWorkExperience.length ? importedWorkExperience : activeProfile?.workExperience ?? [];
  const effectiveGithubUrl = analysisGithubUrl || activeProfile?.githubUrl || "";
  const effectivePortfolioUrl = analysisPortfolioUrl || activeProfile?.portfolioUrl || "";

  const comparisonQuery = useQuery({
    queryKey: ["simulation-comparison", activeProfile?.id, userId, displayedSimulation?.id],
    queryFn: () => getSimulationComparison(activeProfile!.id, userId!),
    enabled: Boolean(activeProfile?.id && userId && displayedSimulation?.id),
    retry: false
  });

  // The AI interview step runs inside onboarding, before the twin is built — it needs a real
  // profile id from the moment the user enters that step, not just once activeProfile exists.
  const interviewProfileId = activeProfile?.id ?? pendingProfile?.id ?? null;

  const interviewQuery = useQuery({
    queryKey: ["interview", interviewProfileId, userId],
    queryFn: () => getInterviewSession(interviewProfileId!, userId!),
    enabled: Boolean(interviewProfileId && userId)
  });

  const reportDetailQuery = useQuery({
    queryKey: ["report-detail", selectedReportId, userId],
    queryFn: () => getReportDetail(selectedReportId!, userId!),
    enabled: Boolean(selectedReportId && userId)
  });

  const scenarioSuggestionsQuery = useQuery({
    queryKey: ["scenario-suggestions", activeProfile?.id, userId],
    queryFn: () => suggestScenarios(activeProfile!.id, userId!),
    enabled: Boolean(activeProfile?.id && userId),
    retry: false
  });

  const suggestedScenarios = scenarioSuggestionsQuery.data?.scenarios.length
    ? { values: scenarioSuggestionsQuery.data.scenarios, version: scenarioSuggestionsQuery.dataUpdatedAt }
    : null;

  function buildProfilePayload(values: OnboardingValues) {
    return {
      label: values.label || undefined,
      fullName: values.fullName,
      email: values.email,
      phone: values.phone || undefined,
      currentRole: values.currentRole,
      currentCompany: values.currentCompany || undefined,
      previousCompanies: sanitizeStringArray(values.previousCompanies),
      workExperience: sanitizeWorkExperienceEntries(displayedWorkExperience),
      yearsExperience: values.yearsExperience,
      goals: sanitizeStringArray(values.goals),
      preferredRoles: sanitizeStringArray(values.preferredRoles),
      dreamCompanies: sanitizeStringArray(values.dreamCompanies),
      preferredCountries: sanitizeStringArray(values.preferredCountries),
      locationPreference: values.locationPreference,
      expectedSalary: values.expectedSalary,
      currentSalary: values.currentSalary,
      noticePeriodWeeks: values.noticePeriodWeeks,
      education: sanitizeStringArray(values.education),
      technicalSkills: sanitizeStringArray(values.technicalSkills),
      softSkills: sanitizeStringArray(values.softSkills),
      languages: sanitizeStringArray(values.languages),
      certifications: sanitizeStringArray(values.certifications),
      achievements: sanitizeStringArray(values.achievements),
      projects: sanitizeStringArray(values.projects),
      portfolioUrl: values.portfolioUrl || undefined,
      githubUrl: values.githubUrl || undefined,
      linkedinUrl: values.linkedinUrl || undefined,
      careerMotivation: values.careerMotivation,
      workStyle: values.workStyle,
      riskTolerance: values.riskTolerance,
      interviewInsights: [values.interviewQ1, values.interviewQ2, values.interviewQ3, values.interviewQ4, values.interviewQ5]
    };
  }

  // Silently creates/updates the profile when the user advances from Reflection into the AI
  // Interview step — that live interview needs a real profile id before it can start, well before
  // the twin itself is built. No toast here; the final Build step is the user-visible outcome.
  const persistDraftProfile = useMutation({
    mutationFn: async (values: OnboardingValues) => {
      const targetProfile = activeProfile ?? pendingProfile;
      const profilePayload = buildProfilePayload(values);
      return targetProfile
        ? await updateProfile(targetProfile.id, profilePayload, userId!)
        : await createProfile(profilePayload, userId!);
    },
    onSuccess: (savedProfile) => {
      if (!activeProfile) setPendingProfile(savedProfile);
    },
    onError: (error) => {
      notify((error as Error).message, "error");
    }
  });

  const buildTwinMutation = useMutation({
    mutationFn: async () => {
      const targetProfile = activeProfile ?? pendingProfile;
      if (!targetProfile) {
        throw new Error("Complete the onboarding steps before building your Career Twin.");
      }
      const builtTwin = await buildTwin(targetProfile.id, userId!);
      return { savedProfile: targetProfile, builtTwin };
    },
    onSuccess: ({ savedProfile, builtTwin }) => {
      queryClient.setQueryData<Profile[]>(["profiles", userId], (existing) => {
        const list = existing ?? [];
        const index = list.findIndex((item) => item.id === savedProfile.id);
        if (index >= 0) {
          const next = [...list];
          next[index] = savedProfile;
          return next;
        }
        return [savedProfile, ...list];
      });
      setIsCreatingNewProfile(false);
      setPendingProfile(null);
      setSelectedProfileId(savedProfile.id);
      if (userId) setStoredSelectedProfileId(userId, savedProfile.id);
      setLatestTwin(builtTwin);
      notify(
        activeProfile ? "Profile updated and twin regenerated successfully." : "New profile created and twin generated successfully.",
        "success"
      );
    },
    onError: (error) => {
      notify((error as Error).message, "error");
    }
  });

  const simulationMutation = useMutation({
    mutationFn: async (values: SimulationFormValues) => {
      if (!activeProfile) {
        throw new Error("Create your profile first.");
      }
      return runSimulation(
        {
          profileId: activeProfile.id,
          scenarios: values.scenarios.map((scenario, index) => ({
            id: `scenario-${index}`,
            name: scenario.name,
            assumptions: scenario.mode === "custom" ? undefined : [scenario.assumption],
            customPrompt: scenario.mode === "custom" ? scenario.customPrompt : undefined
          }))
        },
        userId!
      );
    },
    onSuccess: (simulation) => {
      setLatestSimulation(simulation);
      notify("Simulation completed. Review recommendation and tradeoffs.", "success");
    },
    onError: (error) => {
      notify((error as Error).message, "error");
    }
  });

  const reportMutation = useMutation({
    mutationFn: async () => {
      if (!activeProfile || !displayedSimulation) {
        throw new Error("Run at least one simulation before generating a report.");
      }
      return generateReport({
        userId: userId!,
        profileId: activeProfile.id,
        simulationId: displayedSimulation.id,
        title: `Career decision brief - ${new Date().toLocaleDateString()}`,
        audience: "mentor"
      });
    },
    onSuccess: () => {
      reportsQuery.refetch();
      notify("Report generated successfully.", "success");
    },
    onError: (error) => {
      notify((error as Error).message, "error");
    }
  });

  const analysisMutation = useMutation({
    mutationFn: async () => {
      if (!activeProfile || !analysisContent.trim()) {
        throw new Error("Provide content and create your profile first.");
      }
      return ingestAnalysis({
        userId: userId!,
        profileId: activeProfile.id,
        source: analysisSource,
        content: analysisContent
      });
    },
    onSuccess: () => {
      analysesQuery.refetch();
      setAnalysisContent("");
      notify("Analysis completed and added to your evidence ledger.", "success");
    },
    onError: (error) => {
      notify((error as Error).message, "error");
    }
  });

  const resumeAnalysisMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!activeProfile) {
        throw new Error("Create your profile first.");
      }
      const { rawTextPreview } = await importResume(file, userId!);
      return ingestAnalysis({
        userId: userId!,
        profileId: activeProfile.id,
        source: "resume",
        content: rawTextPreview
      });
    },
    onSuccess: () => {
      analysesQuery.refetch();
      notify("Resume uploaded and analyzed successfully.", "success");
    },
    onError: (error) => {
      notify((error as Error).message, "error");
    }
  });

  const liveAnalysisMutation = useMutation({
    mutationFn: async (source: "github" | "portfolio") => {
      if (!activeProfile) {
        throw new Error("Create your profile first.");
      }
      const sourceUrl = source === "github" ? effectiveGithubUrl.trim() || undefined : effectivePortfolioUrl.trim() || undefined;
      return ingestAnalysis({
        userId: userId!,
        profileId: activeProfile.id,
        source,
        useLiveSource: true,
        sourceUrl
      });
    },
    onSuccess: (_, source) => {
      analysesQuery.refetch();
      notify(`Live ${source} analysis completed and added to your evidence ledger.`, "success");
    },
    onError: (error) => {
      notify((error as Error).message, "error");
    }
  });

  const interviewMutation = useMutation({
    mutationFn: async () => {
      if (!interviewProfileId || !interviewAnswer.trim()) {
        throw new Error("Please provide a thoughtful answer before continuing.");
      }
      return answerInterviewQuestion({
        userId: userId!,
        profileId: interviewProfileId,
        answer: interviewAnswer
      });
    },
    onSuccess: () => {
      setInterviewAnswer("");
      interviewQuery.refetch();
      notify("Interview response recorded. Career Twin context is getting smarter.", "success");
    },
    onError: (error) => {
      notify((error as Error).message, "error");
    }
  });

  const dashboard = dashboardQuery.data;
  const reports = reportsQuery.data ?? [];
  const analyses = analysesQuery.data ?? [];
  const topActions = useMemo(() => dashboard?.nextActions ?? [], [dashboard]);
  const twinMetrics = useMemo(() => {
    const analysisQuality = dashboard?.averageAnalysisScore ?? 52;
    const simulationConfidence = displayedSimulation
      ? Math.round(((displayedSimulation.confidenceBand.min + displayedSimulation.confidenceBand.max) / 2) * 100)
      : 48;
    const roleSignal = activeProfile
      ? Math.min(95, 40 + activeProfile.preferredRoles.length * 9 + activeProfile.technicalSkills.length * 2)
      : 35;
    const leadershipSignal = activeProfile
      ? Math.min(92, 38 + activeProfile.softSkills.length * 8 + activeProfile.interviewInsights.length * 5)
      : 34;
    const marketReadiness = Math.round((analysisQuality + simulationConfidence + roleSignal) / 3);

    return [
      { key: "Technical Strength", score: roleSignal, hint: "Derived from skills, projects, and role targets." },
      { key: "Leadership Signal", score: leadershipSignal, hint: "Derived from interview depth and communication signals." },
      { key: "Market Readiness", score: marketReadiness, hint: "Blend of analysis score and simulation confidence." },
      { key: "Career Confidence", score: simulationConfidence, hint: "AI confidence calibrated across current scenarios." }
    ];
  }, [activeProfile, dashboard?.averageAnalysisScore, displayedSimulation]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-6 py-10 md:px-12">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            Production MVP Build
          </p>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <AuthControls />
          </div>
        </div>
        <h1 className="text-4xl font-semibold tracking-tight text-[var(--foreground)] md:text-5xl">
          Career<span className="gradient-text">Twin</span> AI
        </h1>
        <p className="max-w-3xl text-base text-[var(--muted)] md:text-lg">
          Build your digital career twin and simulate your future with evidence-backed recommendations,
          confidence bands, and actionable next steps.
        </p>
      </header>

      <AiConciergeHero isSignedIn={Boolean(isSignedIn)} hasProfile={Boolean(activeProfile)} />

      <Toast toast={toast} onDismiss={() => setToast(null)} />

      {!isSignedIn ? (
        <EmptyState label="Sign in or sign up to start building your Career Twin." />
      ) : (
        <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <Tabs.List
            className="flex flex-wrap gap-1.5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-[var(--shadow-soft)]"
            aria-label="Product sections"
          >
            {TABS.map(({ value, label, icon: Icon }) => (
              <Tabs.Trigger
                key={value}
                value={value}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-[var(--muted)] transition-all data-[state=active]:bg-[image:var(--gradient-primary)] data-[state=active]:text-white data-[state=active]:shadow-[var(--shadow-soft)]"
              >
                <Icon className="size-3.5" />
                {label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>

          <TwinLiveMap metrics={twinMetrics} />

          <Tabs.Content value="onboarding" className="outline-none">
            <div className="mb-4">
              <ProfileSwitcher
                profiles={profiles}
                activeProfileId={effectiveSelectedProfileId}
                isCreatingNew={isCreatingNewProfile}
                onSelect={selectProfile}
                onCreateNew={startNewProfile}
              />
            </div>
            {userId ? <ResumeImport userId={userId} onDraftReady={handleDraftReady} /> : null}
            {displayedWorkExperience.length ? (
              <div className={`mb-4 ${SUBCARD}`}>
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Imported work history (saved as-is)</p>
                <ul className="mt-1 space-y-1 text-xs text-[var(--foreground)]">
                  {displayedWorkExperience.map((entry, index) => (
                    <li key={`${entry.company}-${index}`}>
                      • {entry.role} at {entry.company} ({entry.duration})
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <OnboardingForm
              key={activeProfile?.id ?? "new-profile"}
              draftSeed={draftSeed}
              profileSeed={profileSeed}
              draftNamespace={userId ? `${userId}:${activeProfile?.id ?? "new"}` : null}
              onEnterInterviewStep={async (values) => {
                await persistDraftProfile.mutateAsync(values);
              }}
              isSavingProfile={persistDraftProfile.isPending}
              interviewSession={interviewQuery.data}
              isInterviewLoading={interviewQuery.isLoading}
              interviewAnswer={interviewAnswer}
              onInterviewAnswerChange={setInterviewAnswer}
              onSubmitInterviewAnswer={() => interviewMutation.mutate()}
              isSubmittingInterviewAnswer={interviewMutation.isPending}
              onSubmit={async () => {
                await buildTwinMutation.mutateAsync();
              }}
              isSubmitting={buildTwinMutation.isPending}
            />
            {!activeProfile ? (
              <div className="mt-4">
                <EmptyState
                  label={
                    isCreatingNewProfile || !profiles.length
                      ? "Complete the form above to create a new career profile."
                      : "No profile created yet. Complete the form above."
                  }
                />
              </div>
            ) : null}
            {buildTwinMutation.isPending ? (
              <div className="mt-4">
                <LoadingState label="Synthesizing your Career Twin from every signal we have..." />
              </div>
            ) : null}
            {displayedTwin ? (
              <div className="mt-4">
                <CareerTwinPanel twin={displayedTwin} />
              </div>
            ) : null}
          </Tabs.Content>

          <Tabs.Content value="simulation" className="space-y-4 outline-none">
            <SimulationForm
              disabled={!activeProfile}
              suggestedScenarios={suggestedScenarios}
              onSubmit={async (values) => {
                await simulationMutation.mutateAsync(values);
              }}
            />
            {simulationMutation.isPending ? <LoadingState label="Running simulation with AI..." /> : null}
            {!displayedSimulation ? <EmptyState label="No simulation run yet. Create at least one profile and run scenarios." /> : null}
            {displayedSimulation ? (
              <div className={`space-y-4 ${CARD}`}>
                <h3 className="text-lg font-semibold text-[var(--foreground)]">Simulation Recommendation</h3>
                <p className="text-sm text-[var(--foreground)]">{displayedSimulation.recommendation}</p>
                <p className="text-sm text-[var(--accent)]">
                  Confidence {displayedSimulation.confidenceBand.min.toFixed(2)} - {displayedSimulation.confidenceBand.max.toFixed(2)}
                </p>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className={SUBCARD}>
                    <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Market Demand</p>
                    <p className="mt-1 text-xs text-[var(--foreground)]">{displayedSimulation.marketDemand}</p>
                  </div>
                  <div className={SUBCARD}>
                    <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Lifestyle Impact</p>
                    <p className="mt-1 text-xs text-[var(--foreground)]">{displayedSimulation.lifestyleImpact}</p>
                  </div>
                  <div className={SUBCARD}>
                    <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Confidence Narrative</p>
                    <p className="mt-1 text-xs text-[var(--foreground)]">{displayedSimulation.confidenceNarrative}</p>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <ul className={`${SUBCARD} space-y-1 text-sm text-[var(--foreground)]`}>
                    <li className="font-medium text-[var(--accent)]">Assumptions</li>
                    {displayedSimulation.assumptions.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                  <ul className={`${SUBCARD} space-y-1 text-sm text-[var(--foreground)]`}>
                    <li className="font-medium text-[var(--accent-2)]">Trade-offs</li>
                    {displayedSimulation.tradeoffs.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {displayedSimulation.scenarios.map((scenario) => (
                    <article key={scenario.name} className={SUBCARD}>
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-medium text-[var(--foreground)]">{scenario.name}</p>
                        <span className="text-xs font-semibold text-[var(--accent)]">{scenario.successProbability}% success</span>
                      </div>
                      <div className="mb-2 h-1.5 w-full rounded-full bg-[var(--border)]">
                        <div
                          className="h-1.5 rounded-full bg-[image:var(--gradient-primary)]"
                          style={{ width: `${scenario.successProbability}%` }}
                        />
                      </div>
                      <p className="text-xs text-[var(--muted)]">Salary projection: {scenario.salaryProjection}</p>
                      <p className="text-xs text-[var(--muted)]">Timeline to goal: {scenario.timelineToGoal}</p>
                      <p className="text-xs text-[var(--muted)]">Salary Growth: {scenario.metrics.salaryGrowth}</p>
                      <p className="text-xs text-[var(--muted)]">Skill Growth: {scenario.metrics.skillGrowth}</p>
                      <p className="text-xs text-[var(--muted)]">Burnout Risk: {scenario.metrics.burnoutRisk}</p>
                      <p className="text-xs text-[var(--muted)]">Promotion Probability: {scenario.metrics.promotionProbability}</p>
                      {scenario.skillGapAnalysis.length ? (
                        <>
                          <p className="mt-2 text-xs font-medium text-[var(--foreground)]">Skill Gaps</p>
                          <ul className="text-xs text-[var(--muted)]">
                            {scenario.skillGapAnalysis.map((gap) => (
                              <li key={gap}>• {gap}</li>
                            ))}
                          </ul>
                        </>
                      ) : null}
                      {scenario.requiredCertifications.length ? (
                        <>
                          <p className="mt-2 text-xs font-medium text-[var(--foreground)]">Suggested Certifications</p>
                          <ul className="text-xs text-[var(--muted)]">
                            {scenario.requiredCertifications.map((cert) => (
                              <li key={cert}>• {cert}</li>
                            ))}
                          </ul>
                        </>
                      ) : null}
                      {scenario.learningRoadmap.length ? (
                        <>
                          <p className="mt-2 text-xs font-medium text-[var(--foreground)]">Learning Roadmap</p>
                          <ul className="text-xs text-[var(--muted)]">
                            {scenario.learningRoadmap.map((step) => (
                              <li key={step}>• {step}</li>
                            ))}
                          </ul>
                        </>
                      ) : null}
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-xs font-medium text-[var(--danger)]">Risks</p>
                          <ul className="text-xs text-[var(--muted)]">
                            {scenario.risks.map((risk) => (
                              <li key={risk}>• {risk}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-[var(--success)]">Opportunities</p>
                          <ul className="text-xs text-[var(--muted)]">
                            {scenario.opportunities.map((opportunity) => (
                              <li key={opportunity}>• {opportunity}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
                {comparisonQuery.data ? (
                  <div className={SUBCARD}>
                    <p className="text-sm font-medium text-[var(--foreground)]">Scenario Comparison Scoreboard</p>
                    <div className="mt-2 space-y-2">
                      {comparisonQuery.data.scenarios.map((scenario) => (
                        <div key={`score-${scenario.name}`} className="rounded-lg border border-[var(--border-soft)] p-2">
                          <div className="flex items-center justify-between text-xs text-[var(--foreground)]">
                            <span>{scenario.name}</span>
                            <span className="text-[var(--accent)]">Overall {scenario.scores.overall}</span>
                          </div>
                          <div className="mt-1 h-2 w-full rounded-full bg-[var(--border)]">
                            <div
                              className="h-2 rounded-full bg-[image:var(--gradient-primary)]"
                              style={{ width: `${scenario.scores.overall}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className={SUBCARD}>
                  <p className="text-sm font-medium text-[var(--foreground)]">Evidence Ledger</p>
                  <ul className="mt-1 space-y-1 text-xs text-[var(--muted)]">
                    {displayedSimulation.evidenceRefs.map((evidence) => (
                      <li key={`${evidence.type}-${evidence.detail}`}>• [{evidence.type}] {evidence.detail}</li>
                    ))}
                  </ul>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className={SUBCARD}>
                    <p className="text-sm font-medium text-[var(--foreground)]">Future Timeline</p>
                    <ul className="mt-1 space-y-1 text-xs text-[var(--muted)]">
                      {displayedSimulation.timeline.map((item) => (
                        <li key={`timeline-${item}`}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                  <div className={SUBCARD}>
                    <p className="text-sm font-medium text-[var(--foreground)]">Recommended Action Plan</p>
                    <ul className="mt-1 space-y-1 text-xs text-[var(--muted)]">
                      {displayedSimulation.actionPlan.map((item) => (
                        <li key={`action-${item}`}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : null}
          </Tabs.Content>

          <Tabs.Content value="analysis" className="space-y-4 outline-none">
            <div className={CARD}>
              <h3 className="text-lg font-semibold text-[var(--foreground)]">Career Signal Analyzer</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Analyze resume, GitHub, portfolio, or LinkedIn content to strengthen your Career Twin evidence.
              </p>
              <div className="mt-3 grid gap-2 sm:flex">
                {(
                  [
                    { key: "resume", label: "Resume", icon: FileText },
                    { key: "github", label: "GitHub", icon: FolderGit2 },
                    { key: "portfolio", label: "Portfolio", icon: Sparkles },
                    { key: "linkedin", label: "LinkedIn", icon: Link2 }
                  ] as const
                ).map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setAnalysisSource(key)}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                      analysisSource === key
                        ? "border-transparent bg-[image:var(--gradient-primary)] text-white"
                        : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface-hover)]"
                    }`}
                  >
                    <Icon className="size-3.5" />
                    {label}
                  </button>
                ))}
              </div>
              {analysisSource === "resume" ? (
                <div className="mt-3 space-y-2">
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--border)] bg-[var(--surface)] p-4 text-center text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)]">
                    <input
                      type="file"
                      accept=".pdf,.docx,image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) resumeAnalysisMutation.mutate(file);
                        event.target.value = "";
                      }}
                    />
                    <Upload className="size-4 text-[var(--accent)]" />
                    {resumeAnalysisMutation.isPending ? "Reading and analyzing your resume..." : "Upload a resume (PDF, DOCX, or image) to analyze"}
                  </label>
                  <p className="text-center text-xs text-[var(--muted)]">or paste resume text below instead</p>
                  <textarea
                    value={analysisContent}
                    onChange={(event) => setAnalysisContent(event.target.value)}
                    placeholder="Paste resume text for analysis..."
                    rows={4}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]"
                  />
                  <Button
                    type="button"
                    onClick={() => analysisMutation.mutate()}
                    disabled={analysisMutation.isPending || !activeProfile || !analysisContent.trim()}
                  >
                    {analysisMutation.isPending ? "Analyzing..." : "Run analysis on pasted text"}
                  </Button>
                </div>
              ) : analysisSource === "github" || analysisSource === "portfolio" ? (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1.5">
                    {analysisSource === "github" ? (
                      <FolderGit2 className="ml-1.5 size-3.5 shrink-0 text-[var(--accent-2)]" />
                    ) : (
                      <Sparkles className="ml-1.5 size-3.5 shrink-0 text-[var(--accent-3)]" />
                    )}
                    <input
                      value={analysisSource === "github" ? effectiveGithubUrl : effectivePortfolioUrl}
                      onChange={(event) =>
                        analysisSource === "github" ? setAnalysisGithubUrl(event.target.value) : setAnalysisPortfolioUrl(event.target.value)
                      }
                      placeholder={analysisSource === "github" ? "https://github.com/username" : "https://yourportfolio.com"}
                      className="flex-1 bg-transparent px-1 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={() => liveAnalysisMutation.mutate(analysisSource)}
                    disabled={
                      liveAnalysisMutation.isPending ||
                      !activeProfile ||
                      !(analysisSource === "github" ? effectiveGithubUrl.trim() : effectivePortfolioUrl.trim())
                    }
                  >
                    {liveAnalysisMutation.isPending ? "Scanning..." : `Analyze this ${analysisSource === "github" ? "GitHub profile" : "portfolio"}`}
                  </Button>
                  <p className="text-xs text-[var(--muted)]">Works with any public URL — doesn&apos;t need to be saved to your profile first.</p>
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={analysisContent}
                    onChange={(event) => setAnalysisContent(event.target.value)}
                    placeholder="Paste your LinkedIn About/Experience text — LinkedIn can't be scraped without login."
                    rows={5}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]"
                  />
                  <Button
                    type="button"
                    onClick={() => analysisMutation.mutate()}
                    disabled={analysisMutation.isPending || !activeProfile || !analysisContent.trim()}
                  >
                    {analysisMutation.isPending ? "Analyzing..." : "Run analysis"}
                  </Button>
                </div>
              )}
            </div>

            {analysesQuery.isLoading ? <LoadingState label="Loading analysis workbench..." /> : null}
            {!analyses.length && !analysesQuery.isLoading ? (
              <EmptyState label="No analyses yet. Add resume/GitHub/portfolio/LinkedIn content to build evidence quality." />
            ) : null}
            {analyses.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {analyses.map((analysis: AnalysisResult) => (
                  <article key={analysis.id} className={CARD}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium uppercase tracking-wide text-[var(--foreground)]">{analysis.source}</p>
                      <p className="text-xs font-semibold text-[var(--accent)]">Score {analysis.score}/100</p>
                    </div>
                    <p className="mt-2 text-xs font-medium text-[var(--muted)]">Strengths</p>
                    <ul className="mt-1 space-y-1 text-xs text-[var(--foreground)]">
                      {analysis.strengths.map((item) => (
                        <li key={`s-${analysis.id}-${item}`}>• {item}</li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs font-medium text-[var(--muted)]">Gaps</p>
                    <ul className="mt-1 space-y-1 text-xs text-[var(--foreground)]">
                      {analysis.gaps.map((item) => (
                        <li key={`g-${analysis.id}-${item}`}>• {item}</li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs font-medium text-[var(--muted)]">Dimension Scores</p>
                    <ul className="mt-1 space-y-1 text-xs text-[var(--foreground)]">
                      {analysis.dimensionScores.map((item) => (
                        <li key={`${analysis.id}-${item.key}`}>
                          • {item.key}: {item.score} ({item.explanation})
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs font-medium text-[var(--muted)]">Recruiter Perspective</p>
                    <p className="text-xs text-[var(--foreground)]">{analysis.recruiterPerspective}</p>
                    <p className="mt-2 text-xs font-medium text-[var(--muted)]">Hiring Manager Perspective</p>
                    <p className="text-xs text-[var(--foreground)]">{analysis.hiringManagerPerspective}</p>
                    <p className="mt-2 text-xs font-medium text-[var(--muted)]">Recommendations</p>
                    <ul className="mt-1 space-y-1 text-xs text-[var(--foreground)]">
                      {analysis.recommendations.map((item) => (
                        <li key={`r-${analysis.id}-${item}`}>• {item}</li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs font-medium text-[var(--muted)]">Priority Improvement Plan</p>
                    <ul className="mt-1 space-y-1 text-xs text-[var(--foreground)]">
                      {analysis.improvementPlan.map((item) => (
                        <li key={`ip-${analysis.id}-${item.action}`}>
                          <span
                            className={`mr-1 rounded px-1 py-0.5 text-[10px] font-semibold uppercase ${
                              item.priority === "high"
                                ? "bg-[var(--danger-soft)] text-[var(--danger)]"
                                : item.priority === "medium"
                                  ? "bg-[var(--accent-3-soft)] text-[var(--accent-3)]"
                                  : "bg-[var(--accent-2-soft)] text-[var(--accent-2)]"
                            }`}
                          >
                            {item.priority}
                          </span>
                          {item.action}
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            ) : null}
          </Tabs.Content>

          <Tabs.Content value="scorecard" className="space-y-4 outline-none">
            {scorecardQuery.isLoading ? <LoadingState label="Building your career scorecard..." /> : null}
            {!activeProfile ? <EmptyState label="Complete onboarding to generate your career scorecard." /> : null}
            {scorecardQuery.data ? <CareerScorecard scorecard={scorecardQuery.data} /> : null}
          </Tabs.Content>

          <Tabs.Content value="dashboard" className="space-y-4 outline-none">
            {dashboardQuery.isLoading ? <LoadingState label="Loading dashboard insights..." /> : null}
            {dashboardQuery.isError ? <ErrorState label={(dashboardQuery.error as Error).message} /> : null}
            {!dashboard && !dashboardQuery.isLoading ? <EmptyState label="Dashboard will populate after onboarding and simulation." /> : null}
            {dashboard ? (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <article className={CARD}>
                    <h3 className="text-lg font-semibold text-[var(--foreground)]">Decision Command Center</h3>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      Latest role: {dashboard.profile.currentRole} | Goals: {dashboard.profile.goals.join(", ")}
                    </p>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      Target roles: {dashboard.profile.preferredRoles.join(", ")}
                    </p>
                    <p className="mt-2 text-sm text-[var(--accent)]">
                      Analysis coverage: {dashboard.analysisCount} sources
                      {dashboard.averageAnalysisScore !== null ? ` | Avg quality score ${dashboard.averageAnalysisScore}` : ""}
                    </p>
                    <p className="mt-2 text-sm text-[var(--muted)]">Reports generated: {dashboard.reportCount}</p>
                  </article>
                  <article className={CARD}>
                    <h3 className="text-lg font-semibold text-[var(--foreground)]">Next Actions</h3>
                    <ul className="mt-2 space-y-1 text-sm text-[var(--foreground)]">
                      {topActions.map((action) => (
                        <li key={action}>• {action}</li>
                      ))}
                    </ul>
                  </article>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <article className={CARD}>
                    <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Career Archetype</p>
                    {displayedTwin ? (
                      <>
                        <p className="mt-2 text-sm font-semibold text-[var(--accent)]">{displayedTwin.careerArchetype}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">{displayedTwin.marketPositioning}</p>
                      </>
                    ) : (
                      <p className="mt-2 text-xs text-[var(--muted)]">Build your Career Twin in Onboarding to see this.</p>
                    )}
                  </article>
                  <article className={CARD}>
                    <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Top Scorecard</p>
                    {scorecardQuery.data ? (
                      <>
                        <p className="mt-2 text-2xl font-bold text-[var(--foreground)]">{scorecardQuery.data.overallScore}/100</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">Overall readiness across resume, GitHub, portfolio, and LinkedIn signals.</p>
                      </>
                    ) : (
                      <p className="mt-2 text-xs text-[var(--muted)]">Run an analysis to unlock your scorecard.</p>
                    )}
                  </article>
                  <article className={CARD}>
                    <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Best Simulated Path</p>
                    {displayedSimulation?.scenarios.length ? (
                      (() => {
                        const best = displayedSimulation.scenarios.reduce(
                          (top, current) => (current.successProbability > top.successProbability ? current : top),
                          displayedSimulation.scenarios[0]
                        );
                        return (
                          <>
                            <p className="mt-2 text-sm font-semibold text-[var(--success)]">{best.name}</p>
                            <p className="mt-1 text-xs text-[var(--muted)]">{best.successProbability}% modeled success</p>
                          </>
                        );
                      })()
                    ) : (
                      <p className="mt-2 text-xs text-[var(--muted)]">Run a simulation to see your best-fit path.</p>
                    )}
                  </article>
                </div>

                {reports.length ? (
                  <article className={CARD}>
                    <h3 className="text-sm font-semibold text-[var(--foreground)]">Recent Reports</h3>
                    <ul className="mt-2 space-y-1.5">
                      {reports.slice(-3).reverse().map((report) => (
                        <li key={report.id} className="flex items-center justify-between text-sm text-[var(--foreground)]">
                          <span className="truncate">{report.title}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedReportId(report.id);
                              setActiveTab("reports");
                            }}
                          >
                            View
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </article>
                ) : null}
              </div>
            ) : null}
          </Tabs.Content>

          <Tabs.Content value="reports" className="space-y-4 outline-none">
            <Button
              type="button"
              onClick={() => reportMutation.mutate()}
              disabled={!activeProfile || !displayedSimulation || reportMutation.isPending}
            >
              {reportMutation.isPending ? "Generating report..." : "Generate mentor report"}
            </Button>
            {reportsQuery.isLoading ? <LoadingState label="Loading report history..." /> : null}
            {reportsQuery.isError ? <ErrorState label={(reportsQuery.error as Error).message} /> : null}
            {!reports.length && !reportsQuery.isLoading ? <EmptyState label="No reports yet. Generate your first report after a simulation." /> : null}
            {reports.length ? (
              <ul className="space-y-3">
                {reports.map((report: Report) => (
                  <li key={report.id} className={CARD}>
                    <p className="text-sm font-medium text-[var(--foreground)]">{report.title}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">{report.summary}</p>
                    <p className="mt-1 text-xs uppercase tracking-wide text-[var(--muted)]">{report.audience} • {report.status}</p>
                    <div className="mt-2 flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => setSelectedReportId(report.id)}>
                        View detail
                      </Button>
                      <Button
                        type="button"
                        variant="soft"
                        size="sm"
                        onClick={() => downloadReportPdf(report.id, userId!).catch((error) => notify((error as Error).message, "error"))}
                      >
                        <Download className="size-3.5" />
                        Download PDF
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
            {reportDetailQuery.data ? (
              <ReportDetailView
                report={reportDetailQuery.data.report}
                sections={reportDetailQuery.data.sections}
                scorecard={scorecardQuery.data ?? null}
                scenarios={displayedSimulation?.scenarios}
                onClose={() => setSelectedReportId(null)}
                onDownloadPdf={() =>
                  downloadReportPdf(reportDetailQuery.data!.report.id, userId!).catch((error) => notify((error as Error).message, "error"))
                }
              />
            ) : null}
          </Tabs.Content>
        </Tabs.Root>
      )}
    </main>
  );
}
