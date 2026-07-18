import { z } from "zod";

const workExperienceSchema = z.object({
  company: z.string().min(1),
  role: z.string().min(1),
  duration: z.string().min(1),
  description: z.string().optional()
});

export const upsertProfileSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  fullName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().max(30).optional(),
  currentRole: z.string().min(2),
  currentCompany: z.string().max(200).optional(),
  previousCompanies: z.array(z.string().min(1)).default([]),
  workExperience: z.array(workExperienceSchema).default([]),
  yearsExperience: z.number().int().min(0).max(50),
  goals: z.array(z.string().min(2)).min(1),
  preferredRoles: z.array(z.string().min(2)).min(1),
  dreamCompanies: z.array(z.string().min(2)).default([]),
  preferredCountries: z.array(z.string().min(2)).default([]),
  locationPreference: z.string().min(2),
  expectedSalary: z.number().int().positive().optional(),
  currentSalary: z.number().int().positive().optional(),
  noticePeriodWeeks: z.number().int().min(0).max(52).optional(),
  education: z.array(z.string().min(2)).default([]),
  technicalSkills: z.array(z.string().min(1)).default([]),
  softSkills: z.array(z.string().min(1)).default([]),
  languages: z.array(z.string().min(1)).default([]),
  certifications: z.array(z.string().min(1)).default([]),
  achievements: z.array(z.string().min(1)).default([]),
  projects: z.array(z.string().min(1)).default([]),
  portfolioUrl: z.string().url().optional(),
  githubUrl: z.string().url().optional(),
  linkedinUrl: z.string().url().optional(),
  resumeText: z.string().max(15000).optional(),
  careerMotivation: z.string().min(8),
  workStyle: z.string().min(4),
  riskTolerance: z.enum(["low", "medium", "high"]),
  interviewInsights: z.array(z.string().min(2)).default([])
});
