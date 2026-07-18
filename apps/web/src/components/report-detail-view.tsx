"use client";

import { AlertTriangle, CheckCircle2, Clock, Download, TrendingUp, Wallet, X } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import type { CareerScorecard, Report, SimulationScenarioResult } from "@/types/domain";

const EVIDENCE_TONES: Record<string, { label: string; bg: string; text: string }> = {
  user_input: { label: "You said", bg: "bg-[var(--accent-soft)]", text: "text-[var(--accent)]" },
  imported_profile: { label: "From profile", bg: "bg-[var(--accent-2-soft)]", text: "text-[var(--accent-2)]" },
  market_signal: { label: "Market signal", bg: "bg-[var(--accent-3-soft)]", text: "text-[var(--accent-3)]" },
  inferred: { label: "AI inferred", bg: "bg-[var(--success-soft)]", text: "text-[var(--success)]" }
};

const SCENARIO_BAR_COLORS = ["var(--accent)", "var(--accent-2)", "var(--accent-3)", "var(--success)"];

function ScoreRing({ score, label, size = 96 }: { score: number; label: string; size?: number }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.max(0, Math.min(100, score)) / 100) * circumference;
  const center = size / 2;

  return (
    <div className="relative flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--border)" strokeWidth={8} />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={8}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-xl font-bold text-[var(--foreground)]">{Math.round(score)}</span>
        <span className="text-[9px] uppercase tracking-wide text-[var(--muted)]">{label}</span>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-2)] p-3.5">
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-[10px] uppercase tracking-wide text-[var(--muted)]">{label}</p>
        <p className="truncate text-sm font-semibold text-[var(--foreground)]">{value}</p>
        {sub ? <p className="truncate text-xs text-[var(--muted)]">{sub}</p> : null}
      </div>
    </div>
  );
}

interface ReportDetailViewProps {
  report: Report;
  sections: {
    executiveSummary: string;
    strengths: string[];
    risks: string[];
    evidence: Array<{ type: string; detail: string }>;
    scenarioHighlight: { name: string; successProbability: number; salaryProjection: string; timelineToGoal: string } | null;
    actionPlan90Days: string[];
  };
  scorecard?: CareerScorecard | null;
  scenarios?: SimulationScenarioResult[];
  onClose: () => void;
  onDownloadPdf: () => void;
}

export function ReportDetailView({ report, sections, scorecard, scenarios, onClose, onDownloadPdf }: ReportDetailViewProps) {
  const chartData = (scenarios ?? []).map((scenario) => ({ name: scenario.name, successProbability: scenario.successProbability }));

  return (
    <div className="space-y-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--accent)]">
            {report.audience} report • {report.status}
          </p>
          <h3 className="text-lg font-semibold text-[var(--foreground)]">{report.title}</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="soft" size="sm" onClick={onDownloadPdf}>
            <Download className="size-3.5" />
            Download PDF
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            <X className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 rounded-xl border border-[var(--border-soft)] bg-[image:var(--gradient-soft)] p-4 md:grid-cols-[auto_1fr]">
        <div className="flex items-center justify-center gap-4">
          {scorecard ? <ScoreRing score={scorecard.overallScore} label="Career" /> : null}
          {sections.scenarioHighlight ? <ScoreRing score={sections.scenarioHighlight.successProbability} label="Best path" /> : null}
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <StatCard
            icon={<TrendingUp className="size-4" />}
            label="Best-fit scenario"
            value={sections.scenarioHighlight?.name ?? "Not yet simulated"}
          />
          <StatCard
            icon={<Wallet className="size-4" />}
            label="Salary projection"
            value={sections.scenarioHighlight?.salaryProjection ?? "—"}
          />
          <StatCard
            icon={<Clock className="size-4" />}
            label="Timeline to goal"
            value={sections.scenarioHighlight?.timelineToGoal ?? "—"}
          />
          <StatCard
            icon={<CheckCircle2 className="size-4" />}
            label="Evidence points"
            value={`${sections.evidence.length} sources cited`}
          />
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-2)] p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Executive summary</p>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--foreground)]">{sections.executiveSummary}</p>
      </div>

      {chartData.length > 1 ? (
        <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-2)] p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Scenario success comparison</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fill: "var(--muted)", fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fill: "var(--muted)", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  formatter={(value) => [`${value ?? 0}%`, "Success probability"]}
                />
                <Bar dataKey="successProbability" radius={[0, 6, 6, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={entry.name} fill={SCENARIO_BAR_COLORS[index % SCENARIO_BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-[var(--success)]/20 bg-[var(--success-soft)] p-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--success)]">
            <CheckCircle2 className="size-3.5" />
            Strengths ({sections.strengths.length})
          </p>
          <ul className="space-y-1.5 text-sm text-[var(--foreground)]">
            {sections.strengths.map((item) => (
              <li key={`st-${item}`} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-[var(--success)]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-[var(--danger)]/20 bg-[var(--danger-soft)] p-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--danger)]">
            <AlertTriangle className="size-3.5" />
            Risks ({sections.risks.length})
          </p>
          <ul className="space-y-1.5 text-sm text-[var(--foreground)]">
            {sections.risks.map((item) => (
              <li key={`rk-${item}`} className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-[var(--danger)]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-2)] p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">90-Day Action Plan</p>
        <ol className="space-y-3">
          {sections.actionPlan90Days.map((item, index) => (
            <li key={`ap-${item}`} className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-[image:var(--gradient-primary)] text-xs font-semibold text-white">
                {index + 1}
              </span>
              <span className="text-sm text-[var(--foreground)]">{item}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-2)] p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Evidence Ledger</p>
        <ul className="space-y-2">
          {sections.evidence.map((item) => {
            const tone = EVIDENCE_TONES[item.type] ?? EVIDENCE_TONES.inferred;
            return (
              <li key={`ev-${item.type}-${item.detail}`} className="flex items-start gap-2 text-sm text-[var(--foreground)]">
                <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone.bg} ${tone.text}`}>
                  {tone.label}
                </span>
                <span>{item.detail}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
