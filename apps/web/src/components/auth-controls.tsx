"use client";

import Link from "next/link";
import { UserButton, useAuth } from "@clerk/nextjs";

export function AuthControls() {
  const { isSignedIn } = useAuth();

  if (isSignedIn) {
    return <UserButton />;
  }

  return (
    <div className="inline-flex items-center gap-2">
      <Link
        href="/sign-in"
        className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--surface-hover)]"
      >
        Sign in
      </Link>
      <Link
        href="/sign-up"
        className="rounded-xl bg-[image:var(--gradient-primary)] px-3 py-2 text-sm font-medium text-white shadow-[var(--shadow-soft)] transition-all hover:brightness-110"
      >
        Sign up
      </Link>
    </div>
  );
}
