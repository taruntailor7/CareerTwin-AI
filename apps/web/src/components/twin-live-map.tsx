"use client";

import { motion } from "framer-motion";

interface TwinLiveMapProps {
  metrics: Array<{
    key: string;
    score: number;
    hint: string;
  }>;
}

export function TwinLiveMap({ metrics }: TwinLiveMapProps) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)]">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--foreground)]">Career Twin Live Map</h3>
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Real-time intelligence</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {metrics.map((metric) => (
          <div key={metric.key} className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-2)] p-3.5">
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-sm text-[var(--foreground)]">{metric.key}</p>
              <p className="text-xs font-medium text-[var(--accent)]">{metric.score}/100</p>
            </div>
            <div className="h-2 w-full rounded-full bg-[var(--border)]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${metric.score}%` }}
                transition={{ duration: 0.5 }}
                className="h-2 rounded-full bg-[image:var(--gradient-primary)]"
              />
            </div>
            <p className="mt-1.5 text-xs text-[var(--muted)]">{metric.hint}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
