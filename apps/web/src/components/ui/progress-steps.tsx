"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProgressStepsProps {
  steps: Array<{ title: string; icon: React.ReactNode }>;
  activeIndex: number;
}

export function ProgressSteps({ steps, activeIndex }: ProgressStepsProps) {
  return (
    <div className="flex items-center gap-1.5">
      {steps.map((step, index) => {
        const isComplete = index < activeIndex;
        const isActive = index === activeIndex;

        return (
          <div key={step.title} className="flex flex-1 items-center gap-1.5">
            <div className="flex flex-col items-center gap-1.5">
              <motion.div
                animate={{
                  scale: isActive ? 1.08 : 1
                }}
                className={cn(
                  "flex size-9 items-center justify-center rounded-full border text-sm font-medium transition-colors",
                  isComplete && "border-transparent bg-[image:var(--gradient-primary)] text-white",
                  isActive && !isComplete && "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]",
                  !isActive && !isComplete && "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]"
                )}
              >
                {isComplete ? <Check className="size-4" /> : step.icon}
              </motion.div>
              <span
                className={cn(
                  "hidden text-[11px] font-medium sm:block",
                  isActive ? "text-[var(--foreground)]" : "text-[var(--muted)]"
                )}
              >
                {step.title}
              </span>
            </div>
            {index < steps.length - 1 ? (
              <div className="relative h-[2px] flex-1 overflow-hidden rounded-full bg-[var(--border)]">
                <motion.div
                  initial={false}
                  animate={{ width: isComplete ? "100%" : "0%" }}
                  transition={{ duration: 0.3 }}
                  className="absolute inset-y-0 left-0 bg-[image:var(--gradient-primary)]"
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
