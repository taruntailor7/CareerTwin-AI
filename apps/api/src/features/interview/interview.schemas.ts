import { z } from "zod";

export const submitInterviewAnswerSchema = z.object({
  profileId: z.string().uuid(),
  answer: z.string().min(4)
});
