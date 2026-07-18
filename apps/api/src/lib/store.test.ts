import assert from "node:assert/strict";
import test from "node:test";
import { store } from "./store.js";

test("store can create profile and fetch latest twin", () => {
  const profile = store.createProfile({
    clerkUserId: "user_test_123",
    label: "Software Engineer track",
    fullName: "Test User",
    email: `test-${Date.now()}@careertwin.ai`,
    currentRole: "Software Engineer",
    previousCompanies: ["Acme Corp"],
    workExperience: [],
    yearsExperience: 5,
    goals: ["Leadership", "AI depth"],
    preferredRoles: ["Staff Engineer"],
    dreamCompanies: ["OpenAI"],
    preferredCountries: ["United States"],
    locationPreference: "Remote",
    expectedSalary: 200000,
    currentSalary: 150000,
    noticePeriodWeeks: 4,
    education: ["B.Tech"],
    technicalSkills: ["TypeScript", "System Design"],
    softSkills: ["Communication"],
    languages: ["English"],
    certifications: ["AWS"],
    achievements: ["Led migration"],
    projects: ["CareerTwin"],
    careerMotivation: "Build impactful AI products.",
    workStyle: "Ownership and async collaboration",
    riskTolerance: "medium",
    interviewInsights: ["Values mentorship", "Enjoys ambiguous problems"]
  });

  const twin = store.saveTwin({
    profileId: profile.id,
    summary: "Twin summary",
    strengths: ["Leadership"],
    growthAreas: ["Storytelling"],
    confidence: { min: 0.6, max: 0.8 },
    careerArchetype: "Emerging Technical Leader",
    marketPositioning: "Strong fit for staff-level engineering roles.",
    recommendedNextSteps: ["Publish a system design case study."],
    dataCompleteness: 70
  });

  assert.equal(store.listProfilesByUser("user_test_123")[0]?.id, profile.id);
  assert.equal(store.getProfile(profile.id)?.id, profile.id);
  assert.equal(store.latestTwinForProfile(profile.id)?.id, twin.id);
});

test("store scopes profile updates to the owning user", () => {
  const profile = store.createProfile({
    clerkUserId: "user_test_456",
    label: "Product track",
    fullName: "Test User Two",
    email: `test-${Date.now()}-2@careertwin.ai`,
    currentRole: "Product Manager",
    previousCompanies: [],
    workExperience: [],
    yearsExperience: 3,
    goals: ["Ship 0-1 products"],
    preferredRoles: ["Senior PM"],
    dreamCompanies: [],
    preferredCountries: [],
    locationPreference: "Remote",
    education: [],
    technicalSkills: [],
    softSkills: [],
    languages: [],
    certifications: [],
    achievements: [],
    projects: [],
    careerMotivation: "Build products people love.",
    workStyle: "Cross-functional collaboration",
    riskTolerance: "low",
    interviewInsights: []
  });

  const blockedUpdate = store.updateProfile(profile.id, "user_test_123", {
    ...profile,
    fullName: "Hijacked Name"
  });
  assert.equal(blockedUpdate, null);

  const allowedUpdate = store.updateProfile(profile.id, "user_test_456", {
    ...profile,
    fullName: "Updated Name"
  });
  assert.equal(allowedUpdate?.fullName, "Updated Name");
});
