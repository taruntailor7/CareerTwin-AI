import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FieldProps {
  label: string;
  icon?: ReactNode;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}

export function Field({ label, icon, error, hint, children, className }: FieldProps) {
  return (
    <label className={cn("flex flex-col gap-1.5 text-sm", className)}>
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--muted)]">
        {icon ? <span className="text-[var(--accent)]">{icon}</span> : null}
        {label}
      </span>
      {children}
      {hint && !error ? <span className="text-xs text-[var(--muted)]">{hint}</span> : null}
      {error ? <span className="text-xs text-[var(--danger)]">{error}</span> : null}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]";
