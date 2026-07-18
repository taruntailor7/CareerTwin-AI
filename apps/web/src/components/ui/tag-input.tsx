"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface TagInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  accent?: "accent" | "accent-2" | "accent-3";
  disabled?: boolean;
}

const ACCENT_MAP = {
  accent: { bg: "bg-[var(--accent-soft)]", text: "text-[var(--accent)]" },
  "accent-2": { bg: "bg-[var(--accent-2-soft)]", text: "text-[var(--accent-2)]" },
  "accent-3": { bg: "bg-[var(--accent-3-soft)]", text: "text-[var(--accent-3)]" }
} as const;

export function TagInput({ value, onChange, placeholder, accent = "accent", disabled }: TagInputProps) {
  const [draft, setDraft] = useState("");
  const palette = ACCENT_MAP[accent];

  function commitDraft() {
    const cleaned = draft.trim().replace(/,$/, "");
    if (!cleaned) return;
    if (!value.includes(cleaned)) {
      onChange([...value, cleaned]);
    }
    setDraft("");
  }

  function removeTag(tag: string) {
    onChange(value.filter((item) => item !== tag));
  }

  return (
    <div
      className={cn(
        "flex min-h-[2.75rem] w-full flex-wrap items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 transition-colors focus-within:border-[var(--accent)]",
        disabled && "pointer-events-none opacity-60"
      )}
    >
      <AnimatePresence initial={false}>
        {value.map((tag) => (
          <motion.span
            key={tag}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium",
              palette.bg,
              palette.text
            )}
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="rounded-full p-0.5 hover:bg-black/10"
              aria-label={`Remove ${tag}`}
            >
              <X className="size-3" />
            </button>
          </motion.span>
        ))}
      </AnimatePresence>
      <input
        value={draft}
        disabled={disabled}
        onChange={(event) => {
          const next = event.target.value;
          if (next.endsWith(",")) {
            setDraft(next);
            commitDraft();
          } else {
            setDraft(next);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === "Tab") {
            event.preventDefault();
            commitDraft();
          }
          if (event.key === "Backspace" && !draft && value.length) {
            removeTag(value[value.length - 1]);
          }
        }}
        onBlur={commitDraft}
        placeholder={value.length ? "" : placeholder}
        className="min-w-[120px] flex-1 bg-transparent px-1 py-1 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
      />
    </div>
  );
}
