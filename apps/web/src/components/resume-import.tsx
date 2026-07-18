"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, FileCheck2, FolderGit2, Globe2, Loader2, Sparkles, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { deleteResumeUpload, getResumeUploads, importGithub, importPortfolio, importResume } from "@/lib/api";
import type { ExtractedProfileDraft, WorkExperienceEntry } from "@/types/domain";
import { Button } from "@/components/ui/button";

interface ResumeImportProps {
  userId: string;
  onDraftReady: (draft: Partial<ExtractedProfileDraft>, summary: string) => void;
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

// AI extraction (and its heuristic fallback) sometimes returns entries with a blank company,
// role, or duration when a resume's history is unclear — the API rejects those as invalid, so
// they're dropped/defaulted here before they ever reach the form.
function sanitizeWorkExperience(entries: WorkExperienceEntry[]): WorkExperienceEntry[] {
  return entries
    .map((entry) => ({
      company: entry.company?.trim() ?? "",
      role: entry.role?.trim() ?? "",
      duration: entry.duration?.trim() || "Not specified",
      description: entry.description?.trim() || undefined
    }))
    .filter((entry) => entry.company && entry.role);
}

function dedupeWorkExperience(entries: WorkExperienceEntry[]): WorkExperienceEntry[] {
  const seen = new Map<string, WorkExperienceEntry>();
  sanitizeWorkExperience(entries).forEach((entry) => {
    const key = `${entry.company.toLowerCase()}|${entry.role.toLowerCase()}`;
    if (!seen.has(key)) seen.set(key, entry);
  });
  return [...seen.values()];
}

// Merges the newly parsed resume with every previously uploaded resume so career
// history (previous companies, projects, work experience) accumulates across uploads
// instead of being overwritten by whichever resume was uploaded last.
function mergeExtractedDrafts(drafts: ExtractedProfileDraft[]): Partial<ExtractedProfileDraft> {
  const firstDefined = <K extends keyof ExtractedProfileDraft>(key: K): ExtractedProfileDraft[K] | undefined =>
    drafts.map((draft) => draft[key]).find((value) => value !== undefined && value !== "");

  return {
    fullName: firstDefined("fullName") as string | undefined,
    email: firstDefined("email") as string | undefined,
    phone: firstDefined("phone") as string | undefined,
    location: firstDefined("location") as string | undefined,
    currentCompany: firstDefined("currentCompany") as string | undefined,
    currentRole: firstDefined("currentRole") as string | undefined,
    yearsExperience: firstDefined("yearsExperience") as number | undefined,
    previousCompanies: dedupe(drafts.flatMap((draft) => draft.previousCompanies)),
    workExperience: dedupeWorkExperience(drafts.flatMap((draft) => draft.workExperience)),
    technicalSkills: dedupe(drafts.flatMap((draft) => draft.technicalSkills)),
    softSkills: dedupe(drafts.flatMap((draft) => draft.softSkills)),
    education: dedupe(drafts.flatMap((draft) => draft.education)),
    certifications: dedupe(drafts.flatMap((draft) => draft.certifications)),
    projects: dedupe(drafts.flatMap((draft) => draft.projects)),
    achievements: dedupe(drafts.flatMap((draft) => draft.achievements)),
    socialLinks: dedupe(drafts.flatMap((draft) => draft.socialLinks))
  };
}

export function ResumeImport({ userId, onDraftReady }: ResumeImportProps) {
  const queryClient = useQueryClient();
  const [isDragging, setIsDragging] = useState(false);
  const [githubUrl, setGithubUrl] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const resumeUploadsQuery = useQuery({
    queryKey: ["resume-uploads", userId],
    queryFn: () => getResumeUploads(userId),
    enabled: Boolean(userId)
  });

  const resumeMutation = useMutation({
    mutationFn: (file: File) => importResume(file, userId),
    onSuccess: ({ draft }) => {
      const priorDrafts = (resumeUploadsQuery.data ?? []).map((upload) => upload.draft);
      const merged = mergeExtractedDrafts([draft, ...priorDrafts]);
      const summary = priorDrafts.length
        ? `${draft.sourceSummary} Merged with ${priorDrafts.length} previously uploaded resume${priorDrafts.length > 1 ? "s" : ""}.`
        : draft.sourceSummary;
      onDraftReady(merged, summary);
      queryClient.invalidateQueries({ queryKey: ["resume-uploads", userId] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (uploadId: string) => deleteResumeUpload(uploadId, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["resume-uploads", userId] })
  });

  const githubMutation = useMutation({
    mutationFn: () => importGithub(githubUrl, userId),
    onSuccess: ({ draft }) =>
      onDraftReady(draft, `Imported ${draft.technicalSkills.length} skills and ${draft.projects.length} projects from GitHub.`)
  });

  const portfolioMutation = useMutation({
    mutationFn: () => importPortfolio(portfolioUrl, userId),
    onSuccess: ({ analysis }) =>
      onDraftReady({}, `Portfolio reachable (score ${analysis.score}/100) — see Analysis tab for full breakdown.`)
  });

  function handleFile(file: File | undefined) {
    if (!file) return;
    resumeMutation.mutate(file);
  }

  const resumeUploads = resumeUploadsQuery.data ?? [];
  const anyError = resumeMutation.error || githubMutation.error || portfolioMutation.error;
  const anyPending = resumeMutation.isPending || githubMutation.isPending || portfolioMutation.isPending;
  const anySuccess = resumeMutation.isSuccess || githubMutation.isSuccess || portfolioMutation.isSuccess;

  return (
    <div className="mb-5 space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
      <div className="flex items-center gap-2">
        <span className="inline-flex size-8 items-center justify-center rounded-lg bg-[image:var(--gradient-primary)] text-white">
          <Sparkles className="size-3.5" />
        </span>
        <div>
          <p className="text-sm font-semibold text-[var(--foreground)]">Auto-fill from your existing profile</p>
          <p className="text-xs text-[var(--muted)]">Upload a resume, or pull signals from GitHub / your portfolio. Nothing is invented — only what we find gets filled in.</p>
        </div>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          handleFile(event.dataTransfer.files[0]);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
          isDragging ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => {
            handleFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        {resumeMutation.isPending ? (
          <Loader2 className="size-6 animate-spin text-[var(--accent)]" />
        ) : (
          <Upload className="size-6 text-[var(--accent)]" />
        )}
        <p className="text-sm font-medium text-[var(--foreground)]">
          {resumeMutation.isPending ? "Reading your resume..." : "Drag & drop your resume, or click to browse"}
        </p>
        <p className="text-xs text-[var(--muted)]">PDF, DOCX, PNG, or JPEG — images are read with on-device OCR. Upload multiple resumes; we merge signals from all of them.</p>
      </div>

      {resumeUploads.length ? (
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Uploaded resumes ({resumeUploads.length})</p>
          <ul className="space-y-1.5">
            {resumeUploads.map((upload) => (
              <li
                key={upload.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2 text-xs"
              >
                <span className="flex items-center gap-1.5 truncate text-[var(--foreground)]">
                  <FileCheck2 className="size-3.5 shrink-0 text-[var(--success)]" />
                  <span className="truncate">{upload.fileName}</span>
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${upload.fileName}`}
                  onClick={() => deleteMutation.mutate(upload.id)}
                  disabled={deleteMutation.isPending}
                  className="shrink-0 rounded p-1 text-[var(--muted)] transition-colors hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1.5">
          <FolderGit2 className="ml-1.5 size-3.5 shrink-0 text-[var(--accent-2)]" />
          <input
            value={githubUrl}
            onChange={(event) => setGithubUrl(event.target.value)}
            placeholder="github.com/username"
            className="flex-1 bg-transparent px-1 text-xs text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
          />
          <Button
            type="button"
            size="sm"
            variant="soft"
            disabled={!githubUrl || githubMutation.isPending}
            onClick={() => githubMutation.mutate()}
          >
            {githubMutation.isPending ? "Scanning..." : "Import"}
          </Button>
        </div>
        <div className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1.5">
          <Globe2 className="ml-1.5 size-3.5 shrink-0 text-[var(--accent-3)]" />
          <input
            value={portfolioUrl}
            onChange={(event) => setPortfolioUrl(event.target.value)}
            placeholder="yourportfolio.com"
            className="flex-1 bg-transparent px-1 text-xs text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
          />
          <Button
            type="button"
            size="sm"
            variant="soft"
            disabled={!portfolioUrl || portfolioMutation.isPending}
            onClick={() => portfolioMutation.mutate()}
          >
            {portfolioMutation.isPending ? "Scanning..." : "Analyze"}
          </Button>
        </div>
      </div>

      {anyError ? (
        <p className="flex items-center gap-1.5 text-xs text-[var(--danger)]">
          <AlertTriangle className="size-3.5" />
          {(anyError as Error).message}
        </p>
      ) : null}
      {!anyError && anySuccess ? (
        <p className="text-xs text-[var(--success)]">Applied to the form below — review before saving.</p>
      ) : null}
      {anyPending ? <p className="text-xs text-[var(--muted)]">This can take a few seconds for scanned images.</p> : null}
    </div>
  );
}
