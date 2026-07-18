import { AlertTriangle, CheckCircle2, Loader2, Sparkles } from "lucide-react";

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--muted)]">
      <Loader2 className="size-4 animate-spin text-[var(--accent)]" />
      {label}
    </div>
  );
}

export function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-4 text-sm text-[var(--muted)]">
      <Sparkles className="size-4 text-[var(--accent)]" />
      {label}
    </div>
  );
}

export function ErrorState({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger-soft)] p-4 text-sm text-[var(--danger)]">
      <AlertTriangle className="size-4" />
      {label}
    </div>
  );
}

export function SuccessState({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-[var(--success)]/30 bg-[var(--success-soft)] p-4 text-sm text-[var(--success)]">
      <CheckCircle2 className="size-4" />
      {label}
    </div>
  );
}
