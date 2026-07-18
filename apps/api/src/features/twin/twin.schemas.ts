import { z } from "zod";

export const buildTwinSchema = z.object({
  profileId: z.string().uuid()
});
