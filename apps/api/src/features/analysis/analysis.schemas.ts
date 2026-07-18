import { z } from "zod";

export const ingestAnalysisSchema = z
  .object({
    profileId: z.string().uuid(),
    source: z.enum(["resume", "github", "portfolio", "linkedin"]),
    content: z.string().min(20).optional(),
    useLiveSource: z.boolean().default(false),
    sourceUrl: z.string().url().optional()
  })
  .refine((value) => Boolean(value.content) || value.useLiveSource, {
    message: "Provide content to analyze, or enable useLiveSource for GitHub/Portfolio.",
    path: ["content"]
  });
