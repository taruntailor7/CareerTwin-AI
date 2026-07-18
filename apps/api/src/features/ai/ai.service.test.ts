import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { runSimulationWithAi } from "./ai.service.js";

test("AI service returns structured fallback output without key", async () => {
  const result = await runSimulationWithAi(
    {
      id: randomUUID(),
      clerkUserId: "user_ai_test",
      label: "AI Product Manager track",
      fullName: "Taylor Test",
      email: "taylor@test.dev",
      currentRole: "Product Engineer",
      previousCompanies: [],
      workExperience: [],
      yearsExperience: 4,
      goals: ["Become AI PM"],
      preferredRoles: ["AI Product Manager"],
      dreamCompanies: ["OpenAI"],
      preferredCountries: ["US"],
      locationPreference: "Hybrid",
      education: ["Bachelors"],
      technicalSkills: ["TypeScript", "Prompt Engineering"],
      softSkills: ["Communication"],
      languages: ["English"],
      certifications: [],
      achievements: [],
      projects: ["Career simulation app"],
      careerMotivation: "Build tools that improve outcomes for people.",
      workStyle: "High autonomy and deep work",
      riskTolerance: "medium",
      interviewInsights: ["Thrives in ambiguity"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    [
      { id: "1", name: "Move to AI PM", assumptions: ["Mentorship support"] },
      { id: "2", name: "Deepen engineering path", assumptions: ["Internal role mobility"] }
    ]
  );

  assert.equal(typeof result.recommendation, "string");
  assert.equal(result.scenarios.length, 2);
  assert.ok(result.confidenceBand.max >= result.confidenceBand.min);
});
