import type { Profile, SimulationResult, SimulationScenarioResult } from "../../types/domain.js";

export interface ReportSections {
  bestScenario: SimulationScenarioResult | null;
  strengths: string[];
  risks: string[];
}

/**
 * Derives report-facing "strengths" and "risks" from the simulation's best-fit scenario
 * plus the profile's real skills — used by both the JSON report detail endpoint and the
 * PDF export so the two stay consistent. Deliberately distinct from `simulation.assumptions`
 * (planning premises) and `simulation.tradeoffs` (general trade-offs), which are not the
 * same thing as the person's actual strengths/risks.
 */
export function deriveReportSections(profile: Profile, simulation: SimulationResult): ReportSections {
  const bestScenario =
    simulation.scenarios.reduce<SimulationScenarioResult | null>(
      (best, current) => (!best || current.successProbability > best.successProbability ? current : best),
      null
    ) ?? null;

  const strengths = [...new Set([...(bestScenario?.opportunities ?? []), ...profile.technicalSkills.slice(0, 2)])].slice(0, 4);
  const risks = [...new Set([...(bestScenario?.risks ?? []), ...simulation.tradeoffs])].slice(0, 4);

  return { bestScenario, strengths, risks };
}
