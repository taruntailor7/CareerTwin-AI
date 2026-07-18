"use client";

import { motion } from "framer-motion";

interface AiConciergeHeroProps {
  isSignedIn: boolean;
  hasProfile: boolean;
}

export function AiConciergeHero({ isSignedIn, hasProfile }: AiConciergeHeroProps) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)]">
      <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-[var(--accent)]/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 -bottom-20 h-64 w-64 rounded-full bg-[var(--accent-2)]/20 blur-3xl" />

      <div className="relative z-10 grid gap-5 md:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-3">
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex rounded-full border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-3 py-1 text-xs uppercase tracking-[0.18em] text-[var(--accent)]"
          >
            AI Career Strategist
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 }}
            className="text-2xl font-semibold tracking-tight text-[var(--foreground)] md:text-3xl"
          >
            Your Career Twin learns like a top-tier mentor, <span className="gradient-text">not a form filler.</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="max-w-2xl text-sm text-[var(--muted)]"
          >
            We map your professional identity, interview your intent, ingest portfolio signals, and simulate
            future career paths with evidence, trade-offs, and confidence calibration.
          </motion.p>
        </div>

        <div className="grid gap-2">
          {[
            { label: "Identity Signal", value: hasProfile ? "Synchronized" : "Waiting for profile context" },
            { label: "AI Interview", value: isSignedIn ? "Adaptive questioning engine active" : "Unlock after sign-in" },
            { label: "Future Simulation", value: "Multi-path strategy + confidence narrative" }
          ].map((item) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-2)] p-3"
            >
              <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{item.label}</p>
              <p className="mt-1 text-sm text-[var(--foreground)]">{item.value}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
