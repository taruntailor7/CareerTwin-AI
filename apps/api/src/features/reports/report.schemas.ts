import { z } from "zod";

export const generateReportSchema = z.object({
  profileId: z.string().uuid(),
  simulationId: z.string().uuid(),
  title: z.string().min(4),
  audience: z.enum(["mentor", "self", "stakeholder"])
});
