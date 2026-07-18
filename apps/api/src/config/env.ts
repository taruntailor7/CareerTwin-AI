import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  DATABASE_URL: z.string().optional(),
  USE_DATABASE: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  CLERK_SECRET_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL_FAST: z.string().default("gemini-flash-latest"),
  GEMINI_MODEL_REASONING: z.string().default("gemini-flash-latest"),
  AI_PROVIDER_PRIMARY: z.string().default("gemini"),
  AI_PROVIDER_FALLBACK: z.string().default("mock"),
  AI_FAILOVER_ENABLED: z
    .string()
    .optional()
    .transform((value) => value !== "false"),
  AI_RETURN_MOCK_ON_FAILURE: z
    .string()
    .optional()
    .transform((value) => value !== "false"),
  FEATURE_GITHUB_IMPORT: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  FEATURE_PORTFOLIO_IMPORT: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  FEATURE_LINKEDIN_URL_MODE: z
    .string()
    .optional()
    .transform((value) => value !== "false"),
  SUPABASE_BUCKET_REPORTS: z.string().default("reports")
});

export const env = envSchema.parse(process.env);
