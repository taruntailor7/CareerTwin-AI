"use client";

import { Check, Plus, User } from "lucide-react";
import type { Profile } from "@/types/domain";

interface ProfileSwitcherProps {
  profiles: Profile[];
  activeProfileId: string | null;
  isCreatingNew: boolean;
  onSelect: (profileId: string) => void;
  onCreateNew: () => void;
}

export function ProfileSwitcher({ profiles, activeProfileId, isCreatingNew, onSelect, onCreateNew }: ProfileSwitcherProps) {
  if (!profiles.length) return null;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow-soft)]">
      <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">Your career profiles</p>
      <div className="flex flex-wrap gap-2">
        {profiles.map((profile) => {
          const isActive = !isCreatingNew && profile.id === activeProfileId;
          return (
            <button
              key={profile.id}
              type="button"
              onClick={() => onSelect(profile.id)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition-all ${
                isActive
                  ? "border-transparent bg-[image:var(--gradient-primary)] text-white shadow-[var(--shadow-soft)]"
                  : "border-[var(--border-soft)] bg-[var(--surface-2)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
              }`}
            >
              <span
                className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full ${
                  isActive ? "bg-white/20" : "bg-[var(--accent-soft)] text-[var(--accent)]"
                }`}
              >
                {isActive ? <Check className="size-3.5" /> : <User className="size-3.5" />}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold leading-tight">{profile.label || profile.currentRole}</span>
                <span className={`block truncate text-[10px] leading-tight ${isActive ? "text-white/80" : "text-[var(--muted)]"}`}>
                  {profile.currentRole}
                </span>
              </span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={onCreateNew}
          className={`flex items-center gap-2 rounded-xl border border-dashed px-3 py-2 text-xs font-semibold transition-all ${
            isCreatingNew
              ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
              : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
          }`}
        >
          <Plus className="size-3.5" />
          New profile
        </button>
      </div>
    </div>
  );
}
