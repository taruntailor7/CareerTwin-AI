import { z } from "zod";

export const simulationScenarioSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(2),
    assumptions: z.array(z.string().min(2)).default([]),
    customPrompt: z.string().min(4).max(600).optional()
  })
  .refine((scenario) => scenario.assumptions.length > 0 || Boolean(scenario.customPrompt), {
    message: "Provide either assumptions or a custom scenario description.",
    path: ["assumptions"]
  });

export const runSimulationSchema = z.object({
  profileId: z.string().uuid(),
  scenarios: z.array(simulationScenarioSchema).min(2).max(4)
});

export const suggestScenariosSchema = z.object({
  profileId: z.string().uuid()
});
