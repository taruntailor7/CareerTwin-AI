"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Plus, Sparkles, X } from "lucide-react";
import { useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";

const PRESET_SCENARIOS = [
  "Switch to AI Engineering",
  "Move to Product Management",
  "Pursue an MBA",
  "Relocate to another country",
  "Focus on Open Source",
  "Become a Technical Architect",
  "Stay in my current company 3 more years",
  "Join a startup",
  "Prepare for FAANG interviews"
];

const ACCENT_CLASSES = [
  { bg: "bg-[var(--accent-soft)]", text: "text-[var(--accent)]" },
  { bg: "bg-[var(--accent-2-soft)]", text: "text-[var(--accent-2)]" },
  { bg: "bg-[var(--accent-3-soft)]", text: "text-[var(--accent-3)]" },
  { bg: "bg-[var(--success-soft)]", text: "text-[var(--success)]" }
];

const scenarioItemSchema = z
  .object({
    name: z.string().min(2, "Name this scenario."),
    mode: z.enum(["preset", "custom"]),
    assumption: z.string(),
    customPrompt: z.string()
  })
  .refine((value) => (value.mode === "custom" ? value.customPrompt.trim().length >= 4 : value.assumption.trim().length >= 2), {
    message: "Fill in this scenario before running the simulation.",
    path: ["assumption"]
  });

const simulationSchema = z.object({
  scenarios: z.array(scenarioItemSchema).min(2).max(4)
});

export type SimulationFormValues = z.infer<typeof simulationSchema>;

interface SimulationFormProps {
  disabled: boolean;
  onSubmit: (values: SimulationFormValues) => Promise<void>;
  suggestedScenarios?: { values: Array<{ name: string; customPrompt: string }>; version: number } | null;
}

export function SimulationForm({ disabled, onSubmit, suggestedScenarios }: SimulationFormProps) {
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<SimulationFormValues>({
    resolver: zodResolver(simulationSchema),
    defaultValues: {
      scenarios: [
        { name: "Switch to AI platform engineering", mode: "preset", assumption: "Can allocate 6 hours/week for upskilling", customPrompt: "" },
        { name: "Stay in current role for promotion path", mode: "preset", assumption: "Promotion cycle in 9-12 months", customPrompt: "" }
      ]
    }
  });
  const { fields, append, remove } = useFieldArray({ control, name: "scenarios" });

  useEffect(() => {
    if (!suggestedScenarios?.values.length) return;
    reset({
      scenarios: suggestedScenarios.values.map((suggestion) => ({
        name: suggestion.name,
        mode: "custom" as const,
        assumption: "",
        customPrompt: suggestion.customPrompt
      }))
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestedScenarios?.version]);

  return (
    <motion.form
      className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)]"
      onSubmit={handleSubmit(onSubmit)}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24 }}
    >
      <div className="flex items-center gap-2">
        <span className="inline-flex size-9 items-center justify-center rounded-xl bg-[image:var(--gradient-primary)] text-white">
          <Sparkles className="size-4" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Future Simulation Engine</h2>
          <p className="text-xs text-[var(--muted)]">
            {suggestedScenarios?.values.length
              ? "AI pre-filled these two scenarios from your profile — edit, replace, or add more below."
              : "Compare up to 4 career futures side by side — pick a preset or write your own."}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PRESET_SCENARIOS.map((preset) => (
          <button
            key={preset}
            type="button"
            disabled={fields.length >= 4}
            onClick={() => append({ name: preset, mode: "preset", assumption: "", customPrompt: "" })}
            className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-xs text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40"
          >
            + {preset}
          </button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {fields.map((field, index) => {
          const accent = ACCENT_CLASSES[index % ACCENT_CLASSES.length];
          const mode = field.mode;
          return (
            <div key={field.id} className={`rounded-xl border border-[var(--border)] p-4 ${accent.bg}`}>
              <div className="mb-2 flex items-center justify-between">
                <p className={`text-xs font-semibold uppercase tracking-wide ${accent.text}`}>Scenario {index + 1}</p>
                {fields.length > 2 ? (
                  <button type="button" onClick={() => remove(index)} className="rounded p-0.5 hover:bg-black/10" aria-label="Remove scenario">
                    <X className="size-3.5" />
                  </button>
                ) : null}
              </div>
              <div className="space-y-2">
                <input {...register(`scenarios.${index}.name`)} className={inputClass} placeholder="Scenario name" />
                {mode === "custom" ? (
                  <textarea
                    {...register(`scenarios.${index}.customPrompt`)}
                    rows={3}
                    className={inputClass}
                    placeholder="Describe this path in your own words — the AI will interpret assumptions, risks, and timeline."
                  />
                ) : (
                  <input {...register(`scenarios.${index}.assumption`)} className={inputClass} placeholder="Key assumption" />
                )}
                {errors.scenarios?.[index]?.assumption ? (
                  <p className="text-xs text-[var(--danger)]">{errors.scenarios[index]?.assumption?.message}</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 border-t border-[var(--border-soft)] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="soft"
          size="md"
          disabled={fields.length >= 4}
          onClick={() => append({ name: "", mode: "custom", assumption: "", customPrompt: "" })}
          className="w-full sm:w-auto"
        >
          <Plus className="size-4" />
          Add custom scenario
        </Button>

        <Button type="submit" disabled={disabled || isSubmitting} size="lg" className="w-full sm:w-auto">
          <Sparkles className="size-4" />
          {isSubmitting ? "Running simulation..." : "Simulate my future"}
        </Button>
      </div>
    </motion.form>
  );
}
