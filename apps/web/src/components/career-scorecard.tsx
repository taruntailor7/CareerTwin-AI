"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, TrendingUp } from "lucide-react";
import { useState } from "react";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from "recharts";
import type { CareerScorecard as CareerScorecardType } from "@/types/domain";

function CircularGauge({ score }: { score: number }) {
  const radius = 54;
  const stroke = 10;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative flex size-32 shrink-0 items-center justify-center">
      <svg width="128" height="128" className="rotate-[-90deg]">
        <circle cx="64" cy="64" r={radius} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke="url(#scoreGradient)"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--accent-2)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold text-[var(--foreground)]">{score}</span>
        <span className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Overall</span>
      </div>
    </div>
  );
}

export function CareerScorecard({ scorecard }: { scorecard: CareerScorecardType }) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const radarData = scorecard.categories.map((category) => ({ category: category.key, score: category.score, fullMark: 100 }));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)] md:grid-cols-[auto_1fr]">
        <div className="flex items-center justify-center">
          <CircularGauge score={scorecard.overallScore} />
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData}>
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="category" tick={{ fill: "var(--muted)", fontSize: 10 }} />
              <Radar dataKey="score" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.35} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {scorecard.categories.map((category) => {
          const isExpanded = expandedKey === category.key;
          return (
            <div key={category.key} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
              <button
                type="button"
                onClick={() => setExpandedKey(isExpanded ? null : category.key)}
                className="flex w-full items-center justify-between gap-2 text-left"
              >
                <div className="flex-1">
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-[var(--foreground)]">{category.key}</span>
                    <span className="text-[var(--accent)]">{category.score}/100</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-[var(--border)]">
                    <div
                      className="h-1.5 rounded-full bg-[image:var(--gradient-primary)]"
                      style={{ width: `${category.score}%` }}
                    />
                  </div>
                </div>
                <ChevronDown className={`size-4 shrink-0 text-[var(--muted)] transition-transform ${isExpanded ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {isExpanded ? (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 space-y-2 border-t border-[var(--border-soft)] pt-2 text-xs">
                      <p className="text-[var(--muted)]">{category.explanation}</p>
                      <p className="text-[var(--danger)]">Why points were lost: {category.pointsLostReason}</p>
                      <ul className="space-y-1 text-[var(--foreground)]">
                        {category.improvementSteps.map((step) => (
                          <li key={step}>• {step}</li>
                        ))}
                      </ul>
                      <p className="flex items-center gap-1 font-medium text-[var(--success)]">
                        <TrendingUp className="size-3.5" />
                        Expected score after improvements: {category.expectedScoreAfterImprovement}/100
                      </p>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
