"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, Compass, Sparkles, Target, TrendingUp } from "lucide-react";
import type { Twin } from "@/types/domain";

function ConfidenceGauge({ min, max }: { min: number; max: number }) {
  const score = Math.round(((min + max) / 2) * 100);
  const radius = 42;
  const stroke = 8;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative flex size-24 shrink-0 items-center justify-center">
      <svg width="96" height="96" className="rotate-[-90deg]">
        <circle cx="48" cy="48" r={radius} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke="url(#twinConfidenceGradient)"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="twinConfidenceGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--accent-2)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-xl font-bold text-[var(--foreground)]">{score}%</span>
        <span className="text-[9px] uppercase tracking-wide text-[var(--muted)]">Confidence</span>
      </div>
    </div>
  );
}

export function CareerTwinPanel({ twin }: { twin: Twin }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-9 items-center justify-center rounded-xl bg-[image:var(--gradient-primary)] text-white">
            <Sparkles className="size-4" />
          </span>
          <div>
            <h3 className="text-lg font-semibold text-[var(--foreground)]">Your Career Twin</h3>
            <p className="text-xs text-[var(--muted)]">Generated from your profile, analyses, and simulation signals.</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-3 py-1 text-xs font-medium text-[var(--accent)]">
          <Compass className="size-3.5" />
          {twin.careerArchetype}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-[auto_1fr] md:items-center">
        <div className="flex items-center justify-center">
          <ConfidenceGauge min={twin.confidence.min} max={twin.confidence.max} />
        </div>
        <div className="space-y-2">
          <p className="text-sm text-[var(--foreground)]">{twin.summary}</p>
          <p className="text-xs text-[var(--muted)]">
            Confidence band {twin.confidence.min.toFixed(2)} - {twin.confidence.max.toFixed(2)} · Data completeness {twin.dataCompleteness}%
          </p>
          <div className="h-1.5 w-full rounded-full bg-[var(--border)]">
            <div className="h-1.5 rounded-full bg-[image:var(--gradient-primary)]" style={{ width: `${twin.dataCompleteness}%` }} />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-2)] p-3.5">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
          <TrendingUp className="size-3.5 text-[var(--accent)]" />
          Market Positioning
        </p>
        <p className="mt-1 text-sm text-[var(--foreground)]">{twin.marketPositioning}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-2)] p-3.5">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--success)]">Strengths</p>
          <ul className="mt-2 space-y-1.5">
            {twin.strengths.map((strength) => (
              <li key={strength} className="flex items-start gap-1.5 text-sm text-[var(--foreground)]">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--success)]" />
                {strength}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-2)] p-3.5">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--accent-3)]">Growth Areas</p>
          <ul className="mt-2 space-y-1.5">
            {twin.growthAreas.map((area) => (
              <li key={area} className="flex items-start gap-1.5 text-sm text-[var(--foreground)]">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--accent-3)]" />
                {area}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--accent)]/25 bg-[var(--accent-soft)] p-3.5">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
          <Target className="size-3.5" />
          Recommended Next Steps
        </p>
        <ul className="mt-2 space-y-1.5">
          {twin.recommendedNextSteps.map((step) => (
            <li key={step} className="flex items-start gap-1.5 text-sm text-[var(--foreground)]">
              <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-[var(--accent)]" />
              {step}
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}
