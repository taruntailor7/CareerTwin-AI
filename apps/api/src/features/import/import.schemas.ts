import { z } from "zod";

export const importGithubSchema = z.object({
  githubUrl: z.string().url()
});

export const importPortfolioSchema = z.object({
  portfolioUrl: z.string().url()
});
