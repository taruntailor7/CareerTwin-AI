"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState, type ReactNode } from "react";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: 60_000,
            refetchOnWindowFocus: false
          }
        }
      })
  );

  return (
    <ClerkProvider>
      {/* next-themes injects an inline <script> before hydration to avoid a theme flash. React 19
          warns about any <script> rendered as a React element unless its type is non-executable
          (e.g. application/json) — this keeps the (harmless, SSR-only) script while silencing that
          false-positive warning. See https://github.com/pacocoursey/next-themes/issues/387. */}
      <ThemeProvider attribute="class" defaultTheme="dark" scriptProps={{ type: "application/json" }}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </ThemeProvider>
    </ClerkProvider>
  );
}
