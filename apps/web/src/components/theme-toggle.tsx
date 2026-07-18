"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

function noopSubscribe() {
  return () => {};
}

// `theme` resolves from localStorage on the client but is always undefined during SSR — rendering
// off it immediately causes a client/server icon mismatch. useSyncExternalStore (rather than a
// setState-in-effect "mounted" flag) is React's own hydration-safe way to say "has this component
// committed on the client yet", matching next-themes' recommended pattern without triggering an
// extra render pass.
function useHasMounted() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useHasMounted();
  const isDark = mounted ? theme !== "light" : true;

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--surface-hover)]"
      aria-label="Toggle dark mode"
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      {isDark ? "Light" : "Dark"}
    </button>
  );
}
