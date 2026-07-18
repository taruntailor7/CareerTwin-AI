"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { useEffect } from "react";

export interface ToastState {
  id: number;
  text: string;
  tone: "success" | "error";
}

const AUTO_DISMISS_MS = 4500;

export function Toast({ toast, onDismiss }: { toast: ToastState | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4 sm:justify-end sm:pr-6">
      <AnimatePresence>
        {toast ? (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.22 }}
            className={`pointer-events-auto flex max-w-md items-start gap-2 rounded-xl border p-3.5 text-sm shadow-[var(--shadow-soft)] backdrop-blur ${
              toast.tone === "error"
                ? "border-[var(--danger)]/30 bg-[var(--danger-soft)] text-[var(--danger)]"
                : "border-[var(--success)]/30 bg-[var(--success-soft)] text-[var(--success)]"
            }`}
          >
            {toast.tone === "error" ? (
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            ) : (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            )}
            <p className="flex-1">{toast.text}</p>
            <button type="button" onClick={onDismiss} aria-label="Dismiss notification" className="shrink-0 rounded p-0.5 hover:bg-black/10">
              <X className="size-3.5" />
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
